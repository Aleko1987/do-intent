import { api } from "encore.dev/api";
import db from "../db";
import type { UpdateRuleRequest, IntentRule } from "./types";

export const updateRule = api(
  { method: "POST", path: "/intent-scorer/rules/update", expose: true },
  async (req: UpdateRuleRequest): Promise<IntentRule> => {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (req.points !== undefined) {
      paramCount++;
      updates.push(`points = $${paramCount}`);
      params.push(req.points);
    }

    if (req.is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      params.push(req.is_active);
    }

    if (req.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      params.push(req.description);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    paramCount++;
    updates.push(`updated_at = now()`);
    params.push(req.rule_key);

    await db.rawExec(
      `UPDATE intent_rules SET ${updates.join(", ")} WHERE rule_key = $${paramCount}`,
      ...params
    );

    const rule = await db.queryRow<IntentRule>`
      SELECT * FROM intent_rules WHERE rule_key = ${req.rule_key}
    `;

    if (!rule) {
      throw new Error("Rule not found");
    }

    return rule;
  }
);
