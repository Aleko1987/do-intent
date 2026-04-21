import { APIError } from "encore.dev/api";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type {
  CandidateSignal,
  CandidateSignalChannel,
  CandidateSignalEventType,
  CandidateSignalQueueItem,
  CandidateSignalSourceType,
  CandidateSignalStatus,
} from "./candidate_signal_types";
import type { IntentEvent } from "./types";
import { autoScoreEvent } from "../intent_scorer/auto_score";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";

const ALLOWED_CHANNELS = new Set<CandidateSignalChannel>([
  "facebook",
  "instagram",
  "whatsapp",
  "email",
  "website",
  "manual_upload",
]);

const ALLOWED_SOURCE_TYPES = new Set<CandidateSignalSourceType>([
  "api",
  "webhook",
  "website_tracker",
  "manual",
  "upload",
  "operator",
]);

const ALLOWED_STATUSES = new Set<CandidateSignalStatus>([
  "pending_review",
  "approved",
  "rejected",
  "promoted",
  "needs_evidence",
  "reminder_sent",
  "evidence_attached",
]);

const ALLOWED_EVENT_TYPES = new Set<CandidateSignalEventType>([
  "post_published",
  "link_clicked",
  "inbound_message",
  "quote_requested",
  "meeting_booked",
  "purchase_made",
  "other",
]);

export interface PromotionSuggestion {
  suggestedEventType: CandidateSignalEventType | null;
  suggestedStage: "M1" | "M2" | "M3" | "M4" | "M5" | null;
  reason: string;
  confidence: number;
}

export function normalizeChannel(input: string): CandidateSignalChannel {
  const normalized = input.trim().toLowerCase() as CandidateSignalChannel;
  if (!ALLOWED_CHANNELS.has(normalized)) {
    throw APIError.invalidArgument("unsupported channel");
  }
  return normalized;
}

export function normalizeSourceType(input: string): CandidateSignalSourceType {
  const normalized = input.trim().toLowerCase() as CandidateSignalSourceType;
  if (!ALLOWED_SOURCE_TYPES.has(normalized)) {
    throw APIError.invalidArgument("unsupported source_type");
  }
  return normalized;
}

export function normalizeEventType(input: string): CandidateSignalEventType {
  const normalized = input.trim().toLowerCase() as CandidateSignalEventType;
  return ALLOWED_EVENT_TYPES.has(normalized) ? normalized : "other";
}

export function normalizeStatus(input: string | undefined): CandidateSignalStatus | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase() as CandidateSignalStatus;
  if (!ALLOWED_STATUSES.has(normalized)) {
    throw APIError.invalidArgument("unsupported status filter");
  }
  return normalized;
}

export function proposePromotion(params: {
  suggestedEventType?: string | null;
  summary?: string | null;
  rawText?: string | null;
}): PromotionSuggestion {
  if (params.suggestedEventType) {
    const eventType = normalizeEventType(params.suggestedEventType);
    if (eventType !== "other") {
      const stage = eventType === "meeting_booked" || eventType === "purchase_made" ? "M5" : "M4";
      return {
        suggestedEventType: eventType,
        suggestedStage: stage,
        reason: "Used existing suggested_event_type from trusted input",
        confidence: 0.8,
      };
    }
  }

  const text = `${params.summary ?? ""} ${params.rawText ?? ""}`.toLowerCase();
  if (/\b(price|pricing|quote|proposal|rfq)\b/.test(text)) {
    return {
      suggestedEventType: "quote_requested",
      suggestedStage: "M4",
      reason: "Detected quote/pricing intent keywords",
      confidence: 0.82,
    };
  }

  if (/\b(book|meeting|demo|call|schedule)\b/.test(text)) {
    return {
      suggestedEventType: "meeting_booked",
      suggestedStage: "M5",
      reason: "Detected meeting booking intent keywords",
      confidence: 0.83,
    };
  }

  if (/\b(purchase|order|checkout|invoice|buy)\b/.test(text)) {
    return {
      suggestedEventType: "purchase_made",
      suggestedStage: "M5",
      reason: "Detected purchase intent keywords",
      confidence: 0.78,
    };
  }

  if (/\b(dm|message|reply|comment|inbound)\b/.test(text)) {
    return {
      suggestedEventType: "inbound_message",
      suggestedStage: "M2",
      reason: "Detected generic inbound interaction",
      confidence: 0.66,
    };
  }

  return {
    suggestedEventType: null,
    suggestedStage: null,
    reason: "Ambiguous signal; requires human review",
    confidence: 0.35,
  };
}

export async function fetchCandidateSignalById(
  id: string,
  ownerUserId: string
): Promise<CandidateSignal> {
  const row = await db.queryRow<CandidateSignal>`
    SELECT *
    FROM candidate_signals
    WHERE id = ${id} AND owner_user_id = ${ownerUserId}
  `;

  if (!row) {
    throw APIError.notFound("candidate signal not found");
  }

  return row;
}

export async function listCandidateSignalQueue(params: {
  ownerUserId: string;
  status?: CandidateSignalStatus;
  channel?: CandidateSignalChannel;
  limit: number;
}): Promise<CandidateSignalQueueItem[]> {
  const queryParams: unknown[] = [params.ownerUserId];
  const whereClauses: string[] = ["cs.owner_user_id = $1"];

  if (params.status) {
    queryParams.push(params.status);
    whereClauses.push(`cs.status = $${queryParams.length}`);
  }

  if (params.channel) {
    queryParams.push(params.channel);
    whereClauses.push(`cs.channel = $${queryParams.length}`);
  }

  queryParams.push(params.limit);

  return db.rawQueryAll<CandidateSignalQueueItem>(
    `
    SELECT
      cs.*,
      COALESCE(COUNT(cse.id), 0)::int AS evidence_count,
      MAX(cse.evidence_ref) AS latest_evidence_ref,
      COALESCE(COUNT(csr.id), 0)::int AS reminder_count,
      (
        ARRAY_REMOVE(ARRAY_AGG(csr.delivery_status ORDER BY csr.created_at DESC), NULL)
      )[1] AS latest_reminder_status,
      MAX(csr.sent_at) AS latest_reminder_sent_at
    FROM candidate_signals cs
    LEFT JOIN candidate_signal_evidence cse ON cse.candidate_signal_id = cs.id
    LEFT JOIN candidate_signal_reminders csr ON csr.candidate_signal_id = cs.id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY cs.id
    ORDER BY
      CASE cs.status
        WHEN 'pending_review' THEN 0
        WHEN 'needs_evidence' THEN 1
        WHEN 'reminder_sent' THEN 2
        WHEN 'evidence_attached' THEN 3
        WHEN 'approved' THEN 4
        ELSE 5
      END,
      cs.occurred_at DESC
    LIMIT $${queryParams.length}
    `,
    ...queryParams
  );
}

export async function promoteCandidateSignalToIntentEvent(params: {
  candidateSignal: CandidateSignal;
  ownerUserId: string;
  eventType?: CandidateSignalEventType | null;
  overrideLeadId?: string | null;
}): Promise<{ event: IntentEvent; autoPushed: boolean }> {
  if (params.candidateSignal.promoted_event_id) {
    const existing = await db.queryRow<IntentEvent>`
      SELECT * FROM intent_events WHERE id = ${params.candidateSignal.promoted_event_id}
    `;
    if (existing) {
      return { event: existing, autoPushed: false };
    }
  }

  const leadId = params.overrideLeadId ?? params.candidateSignal.lead_id;
  if (!leadId) {
    throw APIError.failedPrecondition("candidate signal must be matched to a lead before promotion");
  }

  const selectedEventType = params.eventType ?? params.candidateSignal.suggested_event_type ?? params.candidateSignal.signal_type;

  const rule = await db.queryRow<{ points: number }>`
    SELECT points
    FROM scoring_rules
    WHERE event_type = ${selectedEventType} AND is_active = true
  `;

  const metadata: JsonObject = {
    ...(params.candidateSignal.metadata ?? {}),
    candidate_signal_id: params.candidateSignal.id,
    candidate_signal_channel: params.candidateSignal.channel,
    candidate_signal_source_type: params.candidateSignal.source_type,
  };

  const event = await db.queryRow<IntentEvent>`
    INSERT INTO intent_events (
      lead_id,
      anonymous_id,
      event_type,
      event_source,
      event_value,
      dedupe_key,
      metadata,
      occurred_at,
      created_at
    ) VALUES (
      ${leadId},
      ${params.candidateSignal.anonymous_id},
      ${selectedEventType},
      ${`candidate_signal:${params.candidateSignal.channel}`},
      ${rule?.points ?? 0},
      ${params.candidateSignal.dedupe_key},
      ${JSON.stringify(metadata)},
      ${params.candidateSignal.occurred_at},
      now()
    )
    RETURNING *
  `;

  if (!event) {
    throw APIError.internal("failed to promote candidate signal");
  }

  await db.exec`
    UPDATE candidate_signals
    SET
      promoted_event_id = ${event.id},
      status = 'promoted',
      last_reviewed_at = now(),
      updated_at = now()
    WHERE id = ${params.candidateSignal.id}
      AND owner_user_id = ${params.ownerUserId}
  `;

  await autoScoreEvent(event.id);
  await updateLeadScoring(leadId);
  const pushResult = await checkAndPushToSales(leadId);

  return { event, autoPushed: pushResult.pushed };
}


export function buildWhatsAppReminderTemplate(params: {
  actorDisplay?: string | null;
  actorHandle?: string | null;
  summary?: string | null;
  companyName?: string | null;
}): string {
  const contact = params.actorDisplay ?? params.actorHandle ?? "there";
  const companyPrefix = params.companyName ? ` from ${params.companyName}` : "";
  const context = params.summary ? `Context: ${params.summary}. ` : "";
  return `Hi ${contact}${companyPrefix}, quick follow-up from do-intent. ${context}Could you share a short update here so we can attach it to your request? Thank you.`;
}
