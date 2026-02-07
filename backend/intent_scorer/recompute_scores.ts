import { api } from "encore.dev/api";
import { db } from "../db/db";
import { computeScore } from "./engine";
import { updateLeadRollup } from "./rollups";
import type { RecomputeScoresRequest } from "./types";

interface RecomputeResponse {
  processed: number;
  message: string;
}

export const recomputeScores = api<RecomputeScoresRequest, RecomputeResponse>(
  { method: "POST", path: "/intent-scorer/recompute", expose: true },
  async (req): Promise<RecomputeResponse> => {
    const days = req.days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const events = await db.queryAll<{
      id: string;
      event_type: string;
      event_source: string;
      metadata: Record<string, any>;
      lead_id: string | null;
    }>`
      SELECT id, event_type, event_source, metadata, lead_id 
      FROM intent_events 
      WHERE occurred_at >= ${cutoffDate.toISOString()}
      ORDER BY occurred_at ASC
    `;

    let processed = 0;

    for (const event of events) {
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

      processed++;
    }

    const uniqueLeads = await db.queryAll<{ lead_id: string }>`
      SELECT DISTINCT lead_id 
      FROM intent_events 
      WHERE lead_id IS NOT NULL AND occurred_at >= ${cutoffDate.toISOString()}
    `;

    for (const { lead_id } of uniqueLeads) {
      await updateLeadRollup(lead_id);
    }

    return {
      processed,
      message: `Recomputed scores for ${processed} events from the last ${days} days`,
    };
  }
);

