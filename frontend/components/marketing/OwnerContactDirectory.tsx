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
  updated_at: string;
}

interface ListOwnerContactDirectoryResponse {
  items: OwnerContactDirectoryItemView[];
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
        <Card className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Display</th>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Handle(s)</th>
                <th className="px-3 py-2 font-medium">Email(s)</th>
                <th className="px-3 py-2 font-medium">Phone(s)</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.display_name}</div>
                    <div className="text-xs text-muted-foreground">{row.id}</div>
                  </td>
                  <td className="px-3 py-2">{row.platform}</td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2">
                    {row.handles.length > 0
                      ? row.handles
                          .slice(0, 3)
                          .map((handle) => handle.value)
                          .join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{row.emails.slice(0, 2).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{row.phones.slice(0, 2).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{row.is_active ? "active" : "inactive"}</td>
                  <td className="px-3 py-2">{new Date(row.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No contacts found for current filters.
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
