import { useState } from "react";
import { Search, TrendingUp, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackend } from "../lib/useBackend";
import type { LeadRollupsResponse, LeadRollupWithLead } from "~backend/intent_scorer/types";
import LeadIntentDrawer from "../components/intent/LeadIntentDrawer";

export default function LeadIntent() {
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadRollupWithLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, loading, error } = useBackend<LeadRollupsResponse>(
    (backend) => backend.intent_scorer.listLeadRollups({ search, limit: 50, offset: 0 }),
    [search]
  );

  function getHotnessBadge(score7d: number) {
    if (score7d >= 50) return { label: "🔥 On Fire", variant: "destructive" as const };
    if (score7d >= 25) return { label: "Hot", variant: "default" as const };
    if (score7d >= 10) return { label: "Warm", variant: "secondary" as const };
    return { label: "Cold", variant: "outline" as const };
  }

  function handleLeadClick(lead: LeadRollupWithLead) {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Lead Intent Dashboard</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, company, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">Failed to load leads: {String(error)}</p>
            </CardContent>
          </Card>
        )}

        {data && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Leads ({data.total})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium">Lead</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Last Intent</th>
                      <th className="px-6 py-3 text-right text-sm font-medium">7d Score</th>
                      <th className="px-6 py-3 text-right text-sm font-medium">30d Score</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Top Signal</th>
                      <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          No leads found
                        </td>
                      </tr>
                    ) : (
                      data.leads.map((lead) => {
                        const hotness = getHotnessBadge(lead.score_7d);
                        return (
                          <tr
                            key={lead.lead_id}
                            onClick={() => handleLeadClick(lead)}
                            className="cursor-pointer transition-colors hover:bg-muted/50"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium">
                                  {lead.contact_name || lead.company_name || "Unknown"}
                                </div>
                                {lead.email && (
                                  <div className="text-sm text-muted-foreground">{lead.email}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {lead.last_event_at
                                ? new Date(lead.last_event_at).toLocaleDateString()
                                : "Never"}
                            </td>
                            <td className="px-6 py-4 text-right font-medium">{lead.score_7d}</td>
                            <td className="px-6 py-4 text-right font-medium">{lead.score_30d}</td>
                            <td className="px-6 py-4">
                              {lead.top_signal ? (
                                <Badge variant="secondary">{lead.top_signal}</Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">None</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={hotness.variant}>{hotness.label}</Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedLead && (
        <LeadIntentDrawer
          lead={selectedLead}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </div>
  );
}
