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
