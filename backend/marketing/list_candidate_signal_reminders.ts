import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { CandidateSignalReminder } from "./candidate_signal_types";
import { fetchCandidateSignalById } from "./candidate_signal_service";

interface ListCandidateSignalRemindersRequest {
  id: string;
}

interface ListCandidateSignalRemindersResponse {
  reminders: CandidateSignalReminder[];
}

// Lists reminder history for a candidate signal to preserve operator auditability.
export const listCandidateSignalReminders = api<
  ListCandidateSignalRemindersRequest,
  ListCandidateSignalRemindersResponse
>({ expose: true, method: "GET", path: "/marketing/candidate-signals/:id/reminders", auth: true }, async (req) => {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  await fetchCandidateSignalById(req.id, authData.userID);

  const reminders = await db.queryAll<CandidateSignalReminder>`
    SELECT *
    FROM candidate_signal_reminders
    WHERE candidate_signal_id = ${req.id}
      AND owner_user_id = ${authData.userID}
    ORDER BY created_at DESC
  `;

  return { reminders };
});
