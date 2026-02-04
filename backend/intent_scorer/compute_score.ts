import { api } from "encore.dev/api";
import { db } from "../db/db";
import { computeScore } from "./engine";
import { updateLeadRollup } from "./rollups";
import type { ComputeScoreRequest, IntentScore } from "./types";

export const computeEventScore = api(
  { method: "POST", path: "/intent-scorer/compute", expose: true },
  async (req: ComputeScoreRequest): Promise<IntentScore> => {
    const event = await db.queryRow<{
      id: string;
      event_type: string;
      event_source: string;
      metadata: Record<string, any>;
      lead_id: string | null;
    }>`
      SELECT id, event_type, event_source, metadata, lead_id 
      FROM intent_events 
      WHERE id = ${req.event_id}
    `;

    if (!event) {
      throw new Error("Event not found");
    }

    const scoreResult = await computeScore({
      event_type: event.event_type,
      event_source: event.event_source,
      metadata: event.metadata,
    });

    const existing = await db.queryRow<{ id: string }>`
      SELECT id FROM intent_scores WHERE intent_event_id = ${event.id}
    `;

    let scoreId: string;

    if (existing) {
      await db.exec`
        UPDATE intent_scores 
        SET score = ${scoreResult.score}, confidence = ${scoreResult.confidence}, 
            reasons = ${JSON.stringify(scoreResult.reasons)}, model_version = 'rules_v1', 
            created_at = now()
        WHERE intent_event_id = ${event.id}
      `;
      scoreId = existing.id;
    } else {
      const inserted = await db.queryRow<{ id: string }>`
        INSERT INTO intent_scores (intent_event_id, score, confidence, reasons, model_version)
        VALUES (${event.id}, ${scoreResult.score}, ${scoreResult.confidence}, 
                ${JSON.stringify(scoreResult.reasons)}, 'rules_v1')
        RETURNING id
      `;
      scoreId = inserted!.id;
    }

    if (event.lead_id) {
      await updateLeadRollup(event.lead_id);
    }

    const score = await db.queryRow<IntentScore>`
      SELECT * FROM intent_scores WHERE id = ${scoreId}
    `;

    return score!;
  }
);

