import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";
import type { AccountSummary, ListAccountsRequest, ListAccountsResponse } from "./accounts_types";

export const listAccounts = api<ListAccountsRequest, ListAccountsResponse>(
  { expose: true, method: "POST", path: "/accounts/list" },
  async (req): Promise<ListAccountsResponse> => {
    const limit = Math.min(Math.max(req.limit ?? 25, 1), 100);
    const offset = Math.max(req.offset ?? 0, 0);
    const search = (req.search ?? "").trim().toLowerCase();

    const filter = search ? `%${search}%` : null;

    const totalRow = await db.queryRow<{ total: number }>`
      SELECT COUNT(*)::int as total
      FROM accounts a
      WHERE ${filter}::text IS NULL
         OR a.domain ILIKE ${filter}
         OR COALESCE(a.display_name, '') ILIKE ${filter}
    `;

    const query = `
      WITH member_scores AS (
        SELECT
          am.account_id,
          iss.subject_id as identity_id,
          COALESCE(iss.total_score, 0)::int as total_score,
          iss.last_event_at
        FROM account_members am
        LEFT JOIN intent_subject_scores iss
          ON iss.subject_type = 'identity' AND iss.subject_id = am.identity_id
      ),
      ranked AS (
        SELECT
          account_id,
          total_score,
          ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY total_score DESC) as rn,
          (last_event_at >= NOW() - INTERVAL '14 days') as active_14d
        FROM member_scores
      ),
      rollups AS (
        SELECT
          account_id,
          COALESCE(SUM(CASE WHEN rn <= 3 THEN total_score ELSE 0 END), 0)::int as top3_sum,
          COALESCE(SUM(CASE WHEN active_14d THEN 1 ELSE 0 END), 0)::int as active_people_14d,
          COUNT(*)::int as people_total
        FROM ranked
        GROUP BY account_id
      )
      SELECT
        a.id as account_id,
        a.domain,
        a.display_name,
        LEAST(
          120,
          rollups.top3_sum + LEAST(20, GREATEST(0, rollups.active_people_14d - 1) * 2)
        )::int as account_score,
        rollups.active_people_14d,
        rollups.people_total
      FROM accounts a
      LEFT JOIN rollups ON rollups.account_id = a.id
      WHERE ($1::text IS NULL)
         OR a.domain ILIKE $1
         OR COALESCE(a.display_name, '') ILIKE $1
      ORDER BY account_score DESC, rollups.active_people_14d DESC, a.domain ASC
      LIMIT $2 OFFSET $3
    `;

    const accounts = await db.rawQueryAll<AccountSummary>(query, filter, limit, offset);

    return {
      accounts,
      total: totalRow?.total ?? 0,
    };
  }
);


