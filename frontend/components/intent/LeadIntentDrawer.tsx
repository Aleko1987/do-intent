import { useEffect, useState } from "react";
import { X, TrendingUp, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackend } from "@/lib/useBackend";
import type { LeadRollupWithLead, LeadTrendResponse, LeadTopSignalsResponse } from "~backend/intent_scorer/types";

interface LeadIntentDrawerProps {
  lead: LeadRollupWithLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LeadIntentDrawer({ lead, open, onOpenChange }: LeadIntentDrawerProps) {
  const backend = useBackend();
  const [trend, setTrend] = useState<LeadTrendResponse | null>(null);
  const [topSignals, setTopSignals] = useState<LeadTopSignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && lead) {
      loadData();
    }
  }, [open, lead]);

  async function loadData() {
    setLoading(true);
    try {
      const [trendData, signalsData] = await Promise.all([
        backend.intent_scorer.getLeadTrend({ lead_id: lead.lead_id, days: 14 }),
        backend.intent_scorer.getLeadTopSignals({ lead_id: lead.lead_id, limit: 10 })
      ]);
      setTrend(trendData);
      setTopSignals(signalsData);
    } catch (err) {
      console.error("Failed to load lead data:", err);
    } finally {
      setLoading(false);
    }
  }

  const maxScore = trend ? Math.max(...trend.buckets.map(b => b.total_score), 1) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">
                {lead.contact_name || lead.company_name || "Unknown Lead"}
              </div>
              {lead.email && (
                <div className="text-sm font-normal text-muted-foreground">{lead.email}</div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{lead.score_7d}</div>
                <div className="text-sm text-muted-foreground">7-Day Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{lead.score_30d}</div>
                <div className="text-sm text-muted-foreground">30-Day Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium">
                  {lead.last_event_at
                    ? new Date(lead.last_event_at).toLocaleDateString()
                    : "Never"}
                </div>
                <div className="text-sm text-muted-foreground">Last Intent</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                14-Day Intent Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : trend && trend.buckets.length > 0 ? (
                <div className="flex items-end gap-1 h-32">
                  {trend.buckets.map((bucket, i) => {
                    const height = (bucket.total_score / maxScore) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-primary rounded-t transition-all"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${new Date(bucket.date).toLocaleDateString()}: ${bucket.total_score} pts`}
                        />
                        <div className="text-xs text-muted-foreground">
                          {new Date(bucket.date).getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Top Events (Last 30 Days)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : topSignals && topSignals.events.length > 0 ? (
                <div className="space-y-3">
                  {topSignals.events.map((event) => (
                    <div key={event.event_id} className="flex items-start gap-3 border-b pb-3 last:border-b-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{event.event_type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(event.occurred_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Source: {event.event_source}
                        </div>
                        {event.reasons.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {event.reasons.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">+{event.score}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">No events in the last 30 days</div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button disabled>
              Create Next Step
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
