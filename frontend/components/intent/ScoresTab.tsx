import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackend } from "@/lib/useBackend";
import { RefreshCw, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { EventFilters } from "~backend/intent_scorer/types";

export default function ScoresTab() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<EventFilters>({
    limit: 50,
    offset: 0,
  });
  const [recomputeDays, setRecomputeDays] = useState("30");
  const [isRecomputing, setIsRecomputing] = useState(false);

  const { data, loading, error, execute } = useBackend(
    async (backend) => {
      return await backend.intent_scorer.listEvents(filters);
    },
    [filters]
  );

  const scoredEvents = data?.events.filter((e) => e.score > 0) || [];
  const sortedEvents = [...scoredEvents].sort((a, b) => b.score - a.score);

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      const backend = (await import("~backend/client")).default;
      const result = await backend.intent_scorer.recomputeScores({
        days: parseInt(recomputeDays, 10),
      });
      toast({
        title: "Success",
        description: result.message,
      });
      execute();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to recompute scores",
        variant: "destructive",
      });
    } finally {
      setIsRecomputing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Recompute Scores</CardTitle>
          <CardDescription>Manually trigger score recalculation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium mb-2 block">Days to Recompute</label>
              <Input
                type="number"
                value={recomputeDays}
                onChange={(e) => setRecomputeDays(e.target.value)}
                min="1"
                max="365"
              />
            </div>
            <Button onClick={handleRecompute} disabled={isRecomputing}>
              <Play className="h-4 w-4 mr-2" />
              {isRecomputing ? "Recomputing..." : "Run Scoring"}
            </Button>
            <Button onClick={execute} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading scores...</p>
          </CardContent>
        </Card>
      )}

      {!loading && sortedEvents.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No scored events found. Run scoring to generate scores.</p>
          </CardContent>
        </Card>
      )}

      {!loading && sortedEvents.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Score Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Scored Events</p>
                  <p className="text-2xl font-bold">{sortedEvents.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">
                    {(sortedEvents.reduce((sum, e) => sum + e.score, 0) / sortedEvents.length).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Highest Score</p>
                  <p className="text-2xl font-bold">{sortedEvents[0].score}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {sortedEvents.map((event) => (
              <Card key={event.event_id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-primary">{event.score}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{event.event_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.occurred_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                          {event.event_source}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          Confidence: {(event.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      {event.reasons.length > 0 && (
                        <div className="mt-3 bg-muted p-3 rounded">
                          <p className="text-xs font-semibold mb-2">Scoring Breakdown:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {event.reasons.map((reason, idx) => (
                              <li key={idx}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
