import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBackend } from "@/lib/useBackend";
import { Search, RefreshCw } from "lucide-react";
import type { EventFilters } from "~backend/intent_scorer/types";

export default function EventsTab() {
  const [filters, setFilters] = useState<EventFilters>({
    limit: 50,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data, loading, error, execute } = useBackend(
    async (backend) => {
      return await backend.intent_scorer.listEvents(filters);
    },
    [filters]
  );

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, offset: 0 });
  };

  const handleFilterChange = (key: string, value: string) => {
    if (value === "all") {
      const newFilters = { ...filters };
      delete newFilters[key as keyof EventFilters];
      setFilters({ ...newFilters, offset: 0 });
    } else {
      setFilters({ ...filters, [key]: value, offset: 0 });
    }
  };

  const handleRefresh = () => {
    execute();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filter Events</CardTitle>
          <CardDescription>Search and filter intent events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search in payload..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Select onValueChange={(val) => handleFilterChange("source", val)}>
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="content_ops">Content Ops</SelectItem>
                <SelectItem value="social">Social</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(val) => handleFilterChange("event_type", val)}>
              <SelectTrigger>
                <SelectValue placeholder="All Event Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="page_view">Page View</SelectItem>
                <SelectItem value="time_on_page">Time on Page</SelectItem>
                <SelectItem value="scroll_depth">Scroll Depth</SelectItem>
                <SelectItem value="click">Click</SelectItem>
                <SelectItem value="pricing_view">Pricing View</SelectItem>
                <SelectItem value="form_start">Form Start</SelectItem>
                <SelectItem value="form_submit">Form Submit</SelectItem>
                <SelectItem value="return_visit">Return Visit</SelectItem>
                <SelectItem value="post_published">Post Published</SelectItem>
                <SelectItem value="link_clicked">Link Clicked</SelectItem>
                <SelectItem value="inbound_message">Inbound Message</SelectItem>
                <SelectItem value="quote_requested">Quote Requested</SelectItem>
                <SelectItem value="meeting_booked">Meeting Booked</SelectItem>
                <SelectItem value="purchase_made">Purchase Made</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} total events` : "Loading..."}
            </p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
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
            <p className="text-muted-foreground">Loading events...</p>
          </CardContent>
        </Card>
      )}

      {data && data.events.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No events found</p>
          </CardContent>
        </Card>
      )}

      {data && data.events.length > 0 && (
        <div className="space-y-3">
          {data.events.map((event) => (
            <Card key={event.event_id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-foreground">{event.event_type}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {event.event_source}
                      </span>
                      {event.score > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground">
                          Score: {event.score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(event.occurred_at).toLocaleString()}
                    </p>
                    {Object.keys(event.metadata).length > 0 && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    )}
                    {event.reasons.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1">Scoring Reasons:</p>
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
      )}

      {data && data.total > filters.limit! && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setFilters({ ...filters, offset: Math.max(0, (filters.offset || 0) - filters.limit!) })}
            disabled={!filters.offset || filters.offset === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() => setFilters({ ...filters, offset: (filters.offset || 0) + filters.limit! })}
            disabled={(filters.offset || 0) + filters.limit! >= data.total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
