import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ContactPlatform =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "email"
  | "website"
  | "manual_upload"
  | "unknown";

interface OwnerContactDirectoryItemView {
  id: string;
  source: "csv_upload" | "paste_text" | "api_refresh";
  platform: ContactPlatform;
  display_name: string;
  normalized_name: string;
  is_active: boolean;
  emails: string[];
  handles: Array<{ platform: string | null; value: string; normalized: string }>;
  phones: string[];
  lead_probability_score: number;
  updated_at: string;
}

interface ListOwnerContactDirectoryResponse {
  items: OwnerContactDirectoryItemView[];
}

interface LeadScoreUpdateView {
  id: string;
  surname: string | null;
  name: string | null;
  handle: string | null;
  platform: string;
  score_delta: number;
  new_score: number;
  created_at: string;
}

interface ListLeadScoreUpdatesResponse {
  items: LeadScoreUpdateView[];
}

const PLATFORM_OPTIONS: Array<{ id: ContactPlatform | "all"; label: string }> = [
  { id: "all", label: "All platforms" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "website", label: "Website" },
  { id: "manual_upload", label: "Manual upload" },
  { id: "unknown", label: "Unknown" },
];

export default function OwnerContactDirectory() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<OwnerContactDirectoryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<ContactPlatform | "all">("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [updates, setUpdates] = useState<LeadScoreUpdateView[]>([]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "5000");
    if (search.trim()) params.set("search", search.trim());
    if (platform !== "all") params.set("platform", platform);
    if (includeInactive) params.set("include_inactive", "true");
    return params.toString();
  }, [search, platform, includeInactive]);

  async function apiFetch<T>(path: string): Promise<T> {
    const token = await getToken();
    const response = await fetch(path, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return (await response.json()) as T;
  }

  async function loadDirectory() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ListOwnerContactDirectoryResponse>(
        `/marketing/owner-contacts?${queryString}`
      );
      setRows(response.items);
      const updatesResponse = await apiFetch<ListLeadScoreUpdatesResponse>(
        "/marketing/lead-score-updates?limit=1000"
      );
      setUpdates(updatesResponse.items);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDirectory();
  }, [queryString]);

  function splitName(displayName: string): { name: string; surname: string } {
    const tokens = displayName.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return { name: "—", surname: "—" };
    }
    if (tokens.length === 1) {
      return { name: tokens[0], surname: "—" };
    }
    return { name: tokens[0], surname: tokens.slice(1).join(" ") };
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Contact Directory</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all imported contacts/friends used for entity resolution.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Search display name, handle, email, phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="flex h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as ContactPlatform | "all")}
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant={includeInactive ? "secondary" : "outline"}
            onClick={() => setIncludeInactive((prev) => !prev)}
          >
            {includeInactive ? "Including inactive" : "Active only"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void loadDirectory()}>
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Loaded {rows.length} contacts.</p>
      </Card>

      {loading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading contacts...</Card>
      ) : error ? (
        <Card className="p-4 text-sm text-red-600">Failed to load contacts: {error}</Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="font-medium mb-2">
              Base DB - This DB stores base information of all contacts per platform
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Surname</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Handle</th>
                    <th className="px-3 py-2 font-medium">Platform</th>
                    <th className="px-3 py-2 font-medium">Propensity to convert to lead</th>
                    <th className="px-3 py-2 font-medium">Timestamp of last update</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const split = splitName(row.display_name);
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{split.surname}</td>
                        <td className="px-3 py-2">{split.name}</td>
                        <td className="px-3 py-2">{row.handles[0]?.value ?? "—"}</td>
                        <td className="px-3 py-2">{row.platform}</td>
                        <td className="px-3 py-2">{row.lead_probability_score}</td>
                        <td className="px-3 py-2">{new Date(row.updated_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No contacts found for current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <p className="font-medium mb-2">
              Updates DB - dynamic log of marketing score changes
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Surname</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Handle</th>
                    <th className="px-3 py-2 font-medium">Platform</th>
                    <th className="px-3 py-2 font-medium">Increased/Decreased marketing score</th>
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {updates.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.surname ?? "—"}</td>
                      <td className="px-3 py-2">{item.name ?? "—"}</td>
                      <td className="px-3 py-2">{item.handle ?? "—"}</td>
                      <td className="px-3 py-2">{item.platform}</td>
                      <td className="px-3 py-2">
                        {item.score_delta >= 0 ? "+" : ""}
                        {item.score_delta.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {updates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No score updates recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
