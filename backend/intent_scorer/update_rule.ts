import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { UpdateRuleRequest, IntentRule } from "./types";

export const updateRule = api<UpdateRuleRequest, IntentRule>(
  { method: "POST", path: "/intent-scorer/rules/update", expose: true, auth: true },
  async (req): Promise<IntentRule> => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const ruleKey = req.rule_key?.trim();
    if (!ruleKey) {
      throw APIError.invalidArgument("rule_key is required");
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramCount = 0;

    if (req.points !== undefined) {
      if (!Number.isFinite(req.points) || req.points < 0) {
        throw APIError.invalidArgument("points must be a non-negative number");
      }
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
      if (req.description.length > 500) {
        throw APIError.invalidArgument("description must be 500 characters or fewer");
      }
      paramCount++;
      updates.push(`description = $${paramCount}`);
      params.push(req.description);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    paramCount++;
    updates.push(`updated_at = now()`);
    params.push(ruleKey);

    const existingRule = await db.queryRow<{ id: string }>`
      SELECT id
      FROM intent_rules
      WHERE rule_key = ${ruleKey}
    `;
    if (!existingRule) {
      throw APIError.notFound("rule not found");
    }

    await db.rawExec(
      `UPDATE intent_rules SET ${updates.join(", ")} WHERE rule_key = $${paramCount}`,
      ...params
    );

    const rule = await db.queryRow<IntentRule>`
      SELECT * FROM intent_rules WHERE rule_key = ${ruleKey}
    `;

    if (!rule) {
      throw APIError.notFound("rule not found");
    }

    console.info("[intent_scorer.update_rule] rule updated", {
      uid: authData.userID,
      rule_key: ruleKey,
      updated_fields: updates.filter((update) => update !== "updated_at = now()").length,
    });

    return rule;
  }
);
