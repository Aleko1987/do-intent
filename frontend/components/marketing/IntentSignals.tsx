import { useState, useEffect } from "react";
import type { MarketingLead } from "~backend/marketing/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar } from "lucide-react";
import { useBackend } from "@/lib/useBackend";

export default function IntentSignals() {
  const [topLeads, setTopLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const backend = useBackend();

  useEffect(() => {
    loadTopLeads();
  }, []);

  const loadTopLeads = async () => {
    try {
      const response = await backend.marketing.list({});
      const sorted = [...response.leads].sort(
        (a, b) => b.intent_score - a.intent_score
      );
      setTopLeads(sorted.slice(0, 20));
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading signals...</div>
      </div>
    );
  }

  return (
    <div>
      <Card className="p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">How scoring works</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Intent score is calculated from tracked events using scoring rules, then mapped into a
          pipeline stage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Stage thresholds</h3>
            <div className="space-y-1 text-muted-foreground">
              <div>M1 (Seen): 0-5</div>
              <div>M2 (Engaged): 6-15</div>
              <div>M3 (Educated): 16-30</div>
              <div>M4 (Trust): 31-45</div>
              <div>M5 (Intent): 46+</div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Rule behavior</h3>
            <div className="space-y-1 text-muted-foreground">
              <div>Each event adds rule points for its event type.</div>
              <div>Time decay reduces points by 1 every 7 days.</div>
              <div>Hard-intent rules can immediately force stage M5.</div>
              <div>Auto-push is enabled at score 31+ or stage M5.</div>
            </div>
          </div>
        </div>
      </Card>

      <h2 className="text-xl font-semibold mb-4">Top Intent Signals</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topLeads.map((lead) => (
          <Card key={lead.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">
                  {lead.company_name || "Unknown"}
                </h3>
                <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
              </div>
              <Badge variant="secondary">
                <TrendingUp className="h-3 w-3 mr-1" />
                {lead.intent_score}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stage</span>
                <Badge>{lead.marketing_stage}</Badge>
              </div>
              {lead.last_signal_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Signal</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(lead.last_signal_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{lead.source_type}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
