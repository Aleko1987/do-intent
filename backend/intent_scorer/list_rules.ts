import { api } from "encore.dev/api";
import db from "../db";
import type { IntentRule } from "./types";

interface ListRulesResponse {
  rules: IntentRule[];
}

export const listRules = api(
  { method: "GET", path: "/intent-scorer/rules", expose: true },
  async (): Promise<ListRulesResponse> => {
    const rules = await db.queryAll<IntentRule>`
      SELECT * FROM intent_rules ORDER BY rule_type, rule_key
    `;
    return { rules };
  }
);
