import { db } from "../db/db";
import { tableExists } from "../internal/db";
import { computeScore } from "./engine";

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
    metadata: Record<string, any>;
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

async function updateLeadRollup(leadId: string): Promise<void> {
  const now = new Date();
  const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const score7dRow = await db.queryRow<{ total: number | null }>`
    SELECT SUM(isc.score) as total
    FROM intent_events ie
    JOIN intent_scores isc ON isc.intent_event_id = ie.id
    WHERE ie.lead_id = ${leadId} AND ie.occurred_at >= ${date7d.toISOString()}
  `;

  const score30dRow = await db.queryRow<{ total: number | null }>`
    SELECT SUM(isc.score) as total
    FROM intent_events ie
    JOIN intent_scores isc ON isc.intent_event_id = ie.id
    WHERE ie.lead_id = ${leadId} AND ie.occurred_at >= ${date30d.toISOString()}
  `;

  const lastEventRow = await db.queryRow<{ occurred_at: string }>`
    SELECT occurred_at FROM intent_events WHERE lead_id = ${leadId} ORDER BY occurred_at DESC LIMIT 1
  `;

  const score7d = score7dRow?.total || 0;
  const score30d = score30dRow?.total || 0;
  const lastEventAt = lastEventRow?.occurred_at || null;

  const existing = await db.queryRow<{ lead_id: string }>`
    SELECT lead_id FROM lead_intent_rollups WHERE lead_id = ${leadId}
  `;

  if (existing) {
    await db.exec`
      UPDATE lead_intent_rollups 
      SET score_7d = ${score7d}, score_30d = ${score30d}, last_event_at = ${lastEventAt}, updated_at = now()
      WHERE lead_id = ${leadId}
    `;
  } else {
    await db.exec`
      INSERT INTO lead_intent_rollups (lead_id, score_7d, score_30d, last_event_at)
      VALUES (${leadId}, ${score7d}, ${score30d}, ${lastEventAt})
    `;
  }
}
