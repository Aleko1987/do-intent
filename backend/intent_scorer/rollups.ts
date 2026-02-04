import { db } from "../db/db";
import { bandFromScore, shouldEmitThreshold, ThresholdBand } from "./scoring";

interface LeadRollupResult {
  score_7d: number;
  score_30d: number;
  last_event_at: string | null;
}

export async function updateLeadRollup(leadId: string): Promise<LeadRollupResult> {
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

  const lastEventRow = await db.queryRow<{ id: string; event_type: string; event_source: string; occurred_at: string }>`
    SELECT id, event_type, event_source, occurred_at
    FROM intent_events
    WHERE lead_id = ${leadId}
    ORDER BY occurred_at DESC
    LIMIT 1
  `;

  const score7d = Number(score7dRow?.total || 0);
  const score30d = Number(score30dRow?.total || 0);
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

  await maybeEmitLeadSignal({
    leadId,
    score7d,
    score30d,
    lastEvent: lastEventRow ?? null,
  });

  return {
    score_7d: score7d,
    score_30d: score30d,
    last_event_at: lastEventAt,
  };
}

async function maybeEmitLeadSignal(params: {
  leadId: string;
  score7d: number;
  score30d: number;
  lastEvent: { id: string; event_type: string; event_source: string; occurred_at: string } | null;
}): Promise<void> {
  const { leadId, score7d, score30d, lastEvent } = params;
  const newBand = bandFromScore(score7d);

  const lastSignal = await db.queryRow<{ band: ThresholdBand | null }>`
    SELECT band
    FROM intent_signals
    WHERE lead_id = ${leadId}
    ORDER BY emitted_at DESC
    LIMIT 1
  `;

  const prevBand = lastSignal?.band ?? null;
  const thresholdEmitted = shouldEmitThreshold(prevBand, newBand);

  if (!thresholdEmitted) {
    return;
  }

  const payload = {
    lead_id: leadId,
    score: score7d,
    state: newBand,
    source: lastEvent?.event_source ?? "unknown",
    last_event: lastEvent?.event_type ?? null,
    timestamp: new Date().toISOString(),
  };

  await db.exec`
    INSERT INTO intent_signals (
      lead_id,
      band,
      score_7d,
      score_30d,
      last_event_id,
      last_event_type,
      last_event_source,
      last_event_at,
      payload
    ) VALUES (
      ${leadId},
      ${newBand},
      ${score7d},
      ${score30d},
      ${lastEvent?.id ?? null},
      ${lastEvent?.event_type ?? null},
      ${lastEvent?.event_source ?? null},
      ${lastEvent?.occurred_at ?? null},
      ${JSON.stringify(payload)}
    )
  `;

  await db.exec`
    UPDATE marketing_leads
    SET last_signal_at = now()
    WHERE id = ${leadId}
  `;
}

