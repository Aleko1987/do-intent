import { useMemo, useState } from "react";
import type { MarketingLead } from "~backend/marketing/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBackend } from "@/lib/useBackend";

interface ListLeadsResponse {
  leads: MarketingLead[];
}

const STAGE_OPTIONS = ["all", "M1", "M2", "M3", "M4", "M5"] as const;

function matchesSearch(lead: MarketingLead, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    lead.display_name ?? "",
    lead.contact_name ?? "",
    lead.company_name ?? "",
    lead.company ?? "",
    lead.email ?? "",
    lead.phone ?? "",
    lead.id ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export default function LeadDirectory() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<(typeof STAGE_OPTIONS)[number]>("all");
  const { data, loading, error, execute } = useBackend<ListLeadsResponse>(
    (backend) => backend.marketing.list({}),
    []
  );

  const leads = data?.leads ?? [];
  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const stageMatches = stageFilter === "all" || lead.marketing_stage === stageFilter;
        return stageMatches && matchesSearch(lead, search);
      }),
    [leads, search, stageFilter]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Lead Directory</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View all leads currently stored in the database.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="Search by name, company, email, phone, or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="flex h-9 min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as (typeof STAGE_OPTIONS)[number])}
          >
            {STAGE_OPTIONS.map((stage) => (
              <option key={stage} value={stage}>
                {stage === "all" ? "All stages" : stage}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => void execute()}>
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredLeads.length} of {leads.length} leads.
        </p>
      </Card>

      {loading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading leads...</Card>
      ) : error ? (
        <Card className="p-4 text-sm text-red-600">Failed to load leads: {error}</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Display</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Intent</th>
                <th className="px-3 py-2 font-medium">Last signal</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{lead.display_name ?? lead.contact_name ?? lead.id}</div>
                    <div className="text-xs text-muted-foreground">{lead.id}</div>
                  </td>
                  <td className="px-3 py-2">{lead.company_name || lead.company || "—"}</td>
                  <td className="px-3 py-2">{lead.email || "—"}</td>
                  <td className="px-3 py-2">{lead.phone || "—"}</td>
                  <td className="px-3 py-2">{lead.marketing_stage}</td>
                  <td className="px-3 py-2">{lead.intent_score.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {lead.last_signal_at ? new Date(lead.last_signal_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">{new Date(lead.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No leads match current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
