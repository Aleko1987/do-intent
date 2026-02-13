import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";
import type {
  AccountPersonScore,
  AccountSummary,
  GetAccountRequest,
  GetAccountResponse,
} from "./accounts_types";

export const getAccount = api<GetAccountRequest, GetAccountResponse>(
  { expose: true, method: "POST", path: "/accounts/get" },
  async (req): Promise<GetAccountResponse> => {
    if (!req.account_id) {
      throw APIError.invalidArgument("account_id is required");
    }

    const accountRow = await db.queryRow<{
      id: string;
      domain: string;
      display_name: string | null;
    }>`
      SELECT id, domain, display_name
      FROM accounts
      WHERE id = ${req.account_id}
    `;

    if (!accountRow) {
      throw APIError.notFound("account not found");
    }

    const topPeopleQuery = `
      SELECT
        i.identity_id,
        i.email,
        COALESCE(iss.total_score, 0)::int as total_score,
        iss.last_event_at
      FROM account_members am
      JOIN identities i ON i.identity_id = am.identity_id
      LEFT JOIN intent_subject_scores iss
        ON iss.subject_type = 'identity' AND iss.subject_id = i.identity_id
      WHERE am.account_id = $1
      ORDER BY total_score DESC, iss.last_event_at DESC NULLS LAST
      LIMIT 10
    `;

    const top_people = await db.rawQueryAll<AccountPersonScore>(
      topPeopleQuery,
      req.account_id
    );

    const summaryQuery = `
      WITH member_scores AS (
        SELECT
          am.account_id,
          COALESCE(iss.total_score, 0)::int as total_score,
          iss.last_event_at
        FROM account_members am
        LEFT JOIN intent_subject_scores iss
          ON iss.subject_type = 'identity' AND iss.subject_id = am.identity_id
        WHERE am.account_id = $1
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
      WHERE a.id = $1
    `;

    const account = await db.rawQueryRow<AccountSummary>(summaryQuery, req.account_id);
    if (!account) {
      throw new Error("Failed to compute account rollup");
    }

    return {
      account,
      top_people,
    };
  }
);


