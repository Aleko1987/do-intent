import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { CandidateSignal, CandidateSignalReminder } from "./candidate_signal_types";
import { buildWhatsAppReminderTemplate, fetchCandidateSignalById } from "./candidate_signal_service";

interface RequestCandidateSignalReminderRequest {
  id: string;
  channel?: "whatsapp";
  source_note?: string;
}

interface RequestCandidateSignalReminderResponse {
  reminder: CandidateSignalReminder;
  candidate_signal: CandidateSignal;
  whatsapp_message_url: string;
}

// Creates a manual reminder template for operators. Sending still happens in WhatsApp by a human.
export const requestCandidateSignalReminder = api<
  RequestCandidateSignalReminderRequest,
  RequestCandidateSignalReminderResponse
>({ expose: true, method: "POST", path: "/marketing/candidate-signals/:id/reminders", auth: true }, async (req) => {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  const signal = await fetchCandidateSignalById(req.id, authData.userID);
  const channel = req.channel ?? "whatsapp";

  const metadata: JsonObject = req.source_note
    ? {
        source_note: req.source_note,
      }
    : {};

  const template = buildWhatsAppReminderTemplate({
    actorDisplay: signal.actor_display,
    actorHandle: signal.actor_handle,
    summary: signal.summary,
  });

  const reminder = await db.queryRow<CandidateSignalReminder>`
    INSERT INTO candidate_signal_reminders (
      candidate_signal_id,
      owner_user_id,
      channel,
      template_text,
      delivery_status,
      sent_at,
      metadata,
      created_by_user_id,
      last_updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (
      ${signal.id},
      ${authData.userID},
      ${channel},
      ${template},
      'sent',
      now(),
      ${JSON.stringify(metadata)},
      ${authData.userID},
      ${authData.userID},
      now(),
      now()
    )
    RETURNING *
  `;

  if (!reminder) {
    throw APIError.internal("failed to create reminder");
  }

  const updatedSignal = await db.queryRow<CandidateSignal>`
    UPDATE candidate_signals
    SET
      status = 'reminder_sent',
      updated_at = now()
    WHERE id = ${signal.id}
      AND owner_user_id = ${authData.userID}
    RETURNING *
  `;

  if (!updatedSignal) {
    throw APIError.internal("failed to update candidate status after reminder");
  }

  return {
    reminder,
    candidate_signal: updatedSignal,
    whatsapp_message_url: `https://wa.me/?text=${encodeURIComponent(template)}`,
  };
});
