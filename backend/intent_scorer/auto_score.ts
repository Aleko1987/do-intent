import { db } from "../db/db";
import { tableExists } from "../internal/db";
import type { JsonObject } from "../internal/json_types";
import { computeScore } from "./engine";
import { updateLeadRollup } from "./rollups";

export async function autoScoreEvent(eventId: string): Promise<boolean> {
  const hasRulesTable = await tableExists("intent_rules");
  if (!hasRulesTable) {
    console.info("[autoscore] skipped: missing table intent_rules", {
      table: "intent_rules",
    });
    return false;
  }

  const event = await db.queryRow<{
    id: string;
    event_type: string;
    event_source: string;
    metadata: JsonObject;
    lead_id: string | null;
  }>`
    SELECT id, event_type, event_source, metadata, lead_id 
    FROM intent_events 
    WHERE id = ${eventId}
  `;

  if (!event) {
    return false;
  }

  const scoreResult = await computeScore({
    event_type: event.event_type,
    event_source: event.event_source,
    metadata: event.metadata,
  });

  const existing = await db.queryRow<{ id: string }>`
    SELECT id FROM intent_scores WHERE intent_event_id = ${event.id}
  `;

  if (existing) {
    await db.exec`
      UPDATE intent_scores 
      SET score = ${scoreResult.score}, confidence = ${scoreResult.confidence}, 
          reasons = ${JSON.stringify(scoreResult.reasons)}, model_version = 'rules_v1', 
          created_at = now()
      WHERE intent_event_id = ${event.id}
    `;
  } else {
    await db.exec`
      INSERT INTO intent_scores (intent_event_id, score, confidence, reasons, model_version)
      VALUES (${event.id}, ${scoreResult.score}, ${scoreResult.confidence}, 
              ${JSON.stringify(scoreResult.reasons)}, 'rules_v1')
    `;
  }

  if (event.lead_id) {
    await updateLeadRollup(event.lead_id);
  }

  return true;
}

