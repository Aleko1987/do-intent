import { db } from "../db/db";
import type { ScoringRule } from "./types";
import { readLeadScoringConfig } from "./scoring_config";

interface ScoreResult {
  score: number;
  suggested_stage: string;
  should_auto_push: boolean;
}

export async function calculateLeadScore(leadId: string): Promise<ScoreResult> {
  const config = await readLeadScoringConfig();

  // Get all active scoring rules
  const rules = await db.queryAll<ScoringRule>`
    SELECT * FROM scoring_rules WHERE is_active = true
  `;

  const ruleMap = new Map<string, ScoringRule>();
  rules.forEach((rule) => ruleMap.set(rule.event_type, rule));

  // Get all events for this lead
  const events = await db.queryAll<{
    event_type: string;
    event_value: number;
    occurred_at: string;
  }>`
    SELECT event_type, event_value, occurred_at
    FROM intent_events
    WHERE lead_id = ${leadId}
    ORDER BY occurred_at DESC
  `;

  let totalScore = 0;
  let hasHardIntent = false;
  let hardIntentStage = "M5";

  for (const event of events) {
    const rule = ruleMap.get(event.event_type);
    if (!rule) continue;

    // Apply time decay based on configurable weekly decay.
    const daysSinceEvent = Math.floor(
      (Date.now() - new Date(event.occurred_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const decayWeeks = Math.floor(daysSinceEvent / 7);
    const decayedPoints = Math.max(0, rule.points - (decayWeeks * config.decay_points_per_week));

    totalScore += decayedPoints;

    if (rule.is_hard_intent) {
      hasHardIntent = true;
      if (rule.stage_hint) {
        hardIntentStage = rule.stage_hint;
      }
    }
  }

  // Determine suggested stage
  let suggestedStage = "M1";
  if (hasHardIntent && hardIntentStage === "M5") {
    suggestedStage = "M5";
  } else if (totalScore >= config.m5_min) {
    suggestedStage = "M5";
  } else if (totalScore >= config.m4_min) {
    suggestedStage = "M4";
  } else if (totalScore >= config.m3_min) {
    suggestedStage = "M3";
  } else if (totalScore >= config.m2_min) {
    suggestedStage = "M2";
  }

  const shouldAutoPush = suggestedStage === "M5" || totalScore >= config.auto_push_threshold;

  return {
    score: totalScore,
    suggested_stage: suggestedStage,
    should_auto_push: shouldAutoPush,
  };
}

export async function updateLeadScoring(leadId: string): Promise<void> {
  const before = await db.queryRow<{
    id: string;
    owner_user_id: string;
    contact_name: string | null;
    email: string | null;
    source_type: string | null;
    intent_score: number;
  }>`
    SELECT id, owner_user_id, contact_name, email, source_type, intent_score
    FROM marketing_leads
    WHERE id = ${leadId}
  `;
  if (!before) {
    return;
  }

  const result = await calculateLeadScore(leadId);

  await db.exec`
    UPDATE marketing_leads
    SET 
      intent_score = ${result.score},
      marketing_stage = ${result.suggested_stage},
      last_signal_at = now(),
      updated_at = now()
    WHERE id = ${leadId}
  `;

  const scoreDelta = result.score - Number(before.intent_score ?? 0);
  if (Math.abs(scoreDelta) < 0.0001) {
    return;
  }

  const contactName = (before.contact_name ?? "").trim();
  const tokens = contactName.split(/\s+/).filter(Boolean);
  const firstName = tokens.length > 0 ? tokens[0] : null;
  const surname = tokens.length > 1 ? tokens.slice(1).join(" ") : null;
  const handle = before.email?.includes("@") ? before.email.split("@")[0] : null;
  const platform =
    before.source_type === "website"
      ? "website"
      : before.source_type === "manual"
        ? "manual_upload"
        : before.source_type === "other"
          ? "unknown"
          : before.source_type ?? "unknown";

  await db.exec`
    INSERT INTO marketing_lead_score_updates (
      owner_user_id,
      lead_id,
      surname,
      name,
      handle,
      platform,
      score_delta,
      new_score,
      metadata,
      created_at
    ) VALUES (
      ${before.owner_user_id},
      ${before.id},
      ${surname},
      ${firstName},
      ${handle},
      ${platform},
      ${scoreDelta},
      ${result.score},
      ${JSON.stringify({ suggested_stage: result.suggested_stage })},
      now()
    )
  `;
}
