import db from "../db";
import type { ScoreResult, IntentRule } from "./types";

interface EventData {
  event_type: string;
  event_source: string;
  metadata: Record<string, any>;
}

export async function computeScore(eventData: EventData): Promise<ScoreResult> {
  const rulesGen = db.query<IntentRule>`
    SELECT * FROM intent_rules WHERE is_active = true ORDER BY rule_type, rule_key
  `;

  const rules: IntentRule[] = [];
  for await (const rule of rulesGen) {
    rules.push(rule);
  }

  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.7;

  const baseRule = rules.find(
    (r) => r.rule_type === "base_score" && r.event_type === eventData.event_type
  );

  if (baseRule) {
    score += baseRule.points;
    reasons.push(`Base score for ${eventData.event_type}: +${baseRule.points}`);
  } else {
    reasons.push(`No base score defined for ${eventData.event_type}`);
  }

  const modifierRules = rules.filter((r) => r.rule_type === "modifier");
  for (const rule of modifierRules) {
    if (rule.modifier_condition) {
      const applied = applyModifier(eventData.metadata, rule.modifier_condition);
      if (applied) {
        const modifierPoints = calculateModifierPoints(
          rule.modifier_condition,
          eventData.metadata,
          rule.points
        );
        score += modifierPoints;
        reasons.push(`${rule.description || rule.rule_key}: +${modifierPoints}`);
      }
    }
  }

  if (eventData.event_source === "crm" || eventData.event_source === "website") {
    confidence = 0.85;
  } else if (eventData.event_source === "content_ops") {
    confidence = 0.7;
  } else {
    confidence = 0.55;
  }

  const requiredFields = ["event_type", "event_source"];
  const hasAllFields = requiredFields.every((f) => {
    if (f === "event_type") return !!eventData.event_type;
    if (f === "event_source") return !!eventData.event_source;
    return true;
  });

  if (!hasAllFields) {
    confidence = Math.min(confidence, 0.55);
    reasons.push("Missing key fields, confidence reduced");
  }

  return {
    score: Math.max(0, score),
    confidence: Math.max(0, Math.min(1, confidence)),
    reasons,
  };
}

function applyModifier(
  metadata: Record<string, any>,
  condition: Record<string, any>
): boolean {
  for (const [key, value] of Object.entries(condition)) {
    if (key === "utm_medium") {
      if (metadata.utm_medium !== value) return false;
    } else if (key === "reach_gte") {
      const reach = metadata.reach || 0;
      if (reach < value) return false;
    }
  }
  return true;
}

function calculateModifierPoints(
  condition: Record<string, any>,
  metadata: Record<string, any>,
  basePoints: number
): number {
  if (condition.clicks !== undefined) {
    const clicks = metadata.clicks || 0;
    return Math.min(clicks, 20);
  }
  return basePoints;
}
