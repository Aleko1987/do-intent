import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { MarketingLeadScoreUpdate } from "./entity_resolution_contracts";

interface ListLeadScoreUpdatesRequest {
  limit?: number;
}

interface ListLeadScoreUpdatesResponse {
  items: MarketingLeadScoreUpdate[];
}

// Lists recent lead score changes for audit and review.
export const listLeadScoreUpdates = api<
  ListLeadScoreUpdatesRequest,
  ListLeadScoreUpdatesResponse
>({ expose: true, method: "GET", path: "/marketing/lead-score-updates", auth: true }, async (req) => {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  const limit = req.limit ?? 200;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw APIError.invalidArgument("limit must be a positive integer");
  }

  const items = await db.queryAll<MarketingLeadScoreUpdate>`
    SELECT *
    FROM marketing_lead_score_updates
    WHERE owner_user_id = ${authData.userID}
    ORDER BY created_at DESC
    LIMIT ${Math.min(limit, 1000)}
  `;
  return { items };
});
