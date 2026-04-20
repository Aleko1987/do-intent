export interface CandidateSignalReviewRow {
  id: string;
  who: string;
  channel: "facebook" | "instagram" | "whatsapp" | "email" | "website" | "manual_upload";
  snippet: string;
  matched_lead: string | null;
  suggested_event_type: "inbound_message" | "quote_requested" | "meeting_booked" | "purchase_made" | "other";
  suggested_score: number;
  confidence: number;
  evidence_ref: string | null;
  status: "pending_review" | "needs_evidence" | "approved";
}

export const mockCandidateSignalRows: CandidateSignalReviewRow[] = [
  {
    id: "cand_wa_001",
    who: "+1••• ••• 7782",
    channel: "whatsapp",
    snippet: "Can you quote 20,000L monthly and next-day delivery?",
    matched_lead: null,
    suggested_event_type: "quote_requested",
    suggested_score: 0.84,
    confidence: 0.91,
    evidence_ref: "secure://evidence/wa/cand_wa_001",
    status: "pending_review",
  },
  {
    id: "cand_ig_014",
    who: "@fleetops_midwest",
    channel: "instagram",
    snippet: "DM'd asking for a quick demo this week.",
    matched_lead: "Acme Fleet",
    suggested_event_type: "meeting_booked",
    suggested_score: 0.79,
    confidence: 0.72,
    evidence_ref: null,
    status: "needs_evidence",
  },
  {
    id: "cand_fb_052",
    who: "Unknown commenter",
    channel: "facebook",
    snippet: "Interesting post — sent message via page inbox.",
    matched_lead: null,
    suggested_event_type: "inbound_message",
    suggested_score: 0.44,
    confidence: 0.52,
    evidence_ref: "https://example.com/export/fb_052.csv",
    status: "pending_review",
  },
];
