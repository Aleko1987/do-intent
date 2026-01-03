import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBackend } from "@/lib/useBackend";
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeadIntentListItem {
  lead_id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  score_7d: number;
  score_30d: number;
  last_activity: string | null;
  top_intent_signal: {
    event_type: string;
    score: number;
    occurred_at: string;
  } | null;
}

interface ListLeadsIntentParams {
  min_score_7d?: number;
  min_score_30d?: number;
  activity_days?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: "score_7d" | "score_30d" | "last_activity";
  sort_order?: "asc" | "desc";
}

export default function LeadsTab() {
  const [filters, setFilters] = useState<ListLeadsIntentParams>({
    limit: 50,
    offset: 0,
    sort_by: "score_7d",
    sort_order: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore7d, setMinScore7d] = useState("");
  const [minScore30d, setMinScore30d] = useState("");
  const [activityDays, setActivityDays] = useState("");

  const { data, loading, error, execute } = useBackend(
    async (backend) => {
      return await backend.intent_scorer.listLeadsIntent(filters);
    },
    [filters]
  );

  const handleSearch = () => {
    const newFilters: ListLeadsIntentParams = {
      ...filters,
      search: searchTerm || undefined,
      offset: 0,
    };
    if (minScore7d) newFilters.min_score_7d = parseFloat(minScore7d);
    if (minScore30d) newFilters.min_score_30d = parseFloat(minScore30d);
    if (activityDays) newFilters.activity_days = parseInt(activityDays, 10);
    setFilters(newFilters);
  };

  const handleSort = (sortBy: "score_7d" | "score_30d" | "last_activity") => {
    const newOrder =
      filters.sort_by === sortBy && filters.sort_order === "desc" ? "asc" : "desc";
    setFilters({
      ...filters,
      sort_by: sortBy,
      sort_order: newOrder,
      offset: 0,
    });
  };

  const getSortIcon = (column: "score_7d" | "score_30d" | "last_activity") => {
    if (filters.sort_by !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return filters.sort_order === "desc" ? (
      <ArrowDown className="h-4 w-4 ml-1" />
    ) : (
      <ArrowUp className="h-4 w-4 ml-1" />
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lead Intent Dashboard</CardTitle>
          <CardDescription>View and filter leads by intent scores and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search company/contact/email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Input
              type="number"
              placeholder="Min 7d score"
              value={minScore7d}
              onChange={(e) => setMinScore7d(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            <Input
              type="number"
              placeholder="Min 30d score"
              value={minScore30d}
              onChange={(e) => setMinScore30d(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            <Input
              type="number"
              placeholder="Activity days"
              value={activityDays}
              onChange={(e) => setActivityDays(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} total leads` : "Loading..."}
            </p>
            <Button onClick={execute} variant="outline" size="sm">
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
            <p className="text-muted-foreground">Loading leads...</p>
          </CardContent>
        </Card>
      )}

      {data && data.leads.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No leads found</p>
          </CardContent>
        </Card>
      )}

      {data && data.leads.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Company/Contact</th>
                    <th className="text-left p-2 font-semibold">
                      <button
                        onClick={() => handleSort("score_7d")}
                        className="flex items-center hover:text-primary"
                      >
                        7d Score
                        {getSortIcon("score_7d")}
                      </button>
                    </th>
                    <th className="text-left p-2 font-semibold">
                      <button
                        onClick={() => handleSort("score_30d")}
                        className="flex items-center hover:text-primary"
                      >
                        30d Score
                        {getSortIcon("score_30d")}
                      </button>
                    </th>
                    <th className="text-left p-2 font-semibold">
                      <button
                        onClick={() => handleSort("last_activity")}
                        className="flex items-center hover:text-primary"
                      >
                        Last Activity
                        {getSortIcon("last_activity")}
                      </button>
                    </th>
                    <th className="text-left p-2 font-semibold">Top Intent Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead) => (
                    <tr key={lead.lead_id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">
                            {lead.company_name || lead.contact_name || "Unknown"}
                          </div>
                          {lead.company_name && lead.contact_name && (
                            <div className="text-sm text-muted-foreground">{lead.contact_name}</div>
                          )}
                          {lead.email && (
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <span className="font-semibold text-primary">{lead.score_7d.toFixed(1)}</span>
                      </td>
                      <td className="p-2">
                        <span className="font-semibold text-primary">{lead.score_30d.toFixed(1)}</span>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">
                        {formatDate(lead.last_activity)}
                      </td>
                      <td className="p-2">
                        {lead.top_intent_signal ? (
                          <div>
                            <Badge variant="secondary" className="mr-2">
                              {lead.top_intent_signal.event_type}
                            </Badge>
                            <span className="text-sm font-medium">{lead.top_intent_signal.score}</span>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(lead.top_intent_signal.occurred_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No signal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.total > filters.limit! && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() =>
              setFilters({
                ...filters,
                offset: Math.max(0, (filters.offset || 0) - filters.limit!),
              })
            }
            disabled={!filters.offset || filters.offset === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() =>
              setFilters({
                ...filters,
                offset: (filters.offset || 0) + filters.limit!,
              })
            }
            disabled={(filters.offset || 0) + filters.limit! >= data.total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

