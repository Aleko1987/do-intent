import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

interface EmptyRequest {
  dummy?: string;
}
import { db } from "../db/db";
import type { IntentRule } from "./types";

interface ListRulesResponse {
  rules: IntentRule[];
}

export const listRules = api<EmptyRequest, ListRulesResponse>(
  { method: "GET", path: "/intent-scorer/rules", expose: true, auth: true },
  async (): Promise<ListRulesResponse> => {
    getAuthData()!;
    const rules = await db.queryAll<IntentRule>`
      SELECT * FROM intent_rules ORDER BY rule_type, rule_key
    `;
    return { rules };
  }
);
