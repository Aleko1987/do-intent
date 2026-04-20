import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { CandidateSignalChannel, CandidateSignalQueueItem, CandidateSignalStatus } from "./candidate_signal_types";
import { listCandidateSignalQueue, normalizeChannel, normalizeStatus } from "./candidate_signal_service";

interface ListCandidateSignalsRequest {
  status?: string;
  channel?: string;
  limit?: number;
}

interface ListCandidateSignalsResponse {
  items: CandidateSignalQueueItem[];
}

function parseLimit(limit: number | undefined): number {
  if (limit === undefined) return 50;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw APIError.invalidArgument("limit must be a positive integer");
  }
  return Math.min(limit, 200);
}

// Lists candidate signals for operator review.
export const listCandidateSignals = api<ListCandidateSignalsRequest, ListCandidateSignalsResponse>(
  { expose: true, method: "GET", path: "/marketing/candidate-signals", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const status = normalizeStatus(req.status) as CandidateSignalStatus | undefined;
    const channel = req.channel ? (normalizeChannel(req.channel) as CandidateSignalChannel) : undefined;
    const items = await listCandidateSignalQueue({
      ownerUserId: authData.userID,
      status,
      channel,
      limit: parseLimit(req.limit),
    });

    return { items };
  }
);
