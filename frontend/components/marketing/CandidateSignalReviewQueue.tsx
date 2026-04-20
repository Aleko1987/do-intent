import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockCandidateSignalRows } from "./mockCandidateSignals";

const CHANNEL_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  facebook: "default",
  instagram: "secondary",
  whatsapp: "outline",
  email: "secondary",
  website: "default",
  manual_upload: "outline",
};

export default function CandidateSignalReviewQueue() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Candidate Signal Review Queue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Human review is required before promotion to canonical intent events.
        </p>
      </div>

      <div className="space-y-3">
        {mockCandidateSignalRows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{row.who}</span>
                  <Badge variant={CHANNEL_BADGE_VARIANTS[row.channel] ?? "outline"}>{row.channel}</Badge>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{row.snippet}</p>
                <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <span>Matched lead: {row.matched_lead ?? "Unknown"}</span>
                  <span>Suggested event: {row.suggested_event_type}</span>
                  <span>Suggested score: {row.suggested_score.toFixed(2)}</span>
                  <span>Confidence: {row.confidence.toFixed(2)}</span>
                  <span className="md:col-span-2">Evidence: {row.evidence_ref ?? "No evidence attached"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:w-[320px] md:justify-end">
                <Button size="sm">Approve</Button>
                <Button size="sm" variant="secondary">
                  Edit
                </Button>
                <Button size="sm" variant="outline">
                  Reject
                </Button>
                <Button size="sm" variant="outline">
                  Merge Lead
                </Button>
                <Button size="sm" variant="outline">
                  Create Lead
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
