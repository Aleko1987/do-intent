import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Platform = "facebook" | "instagram" | "whatsapp";
type TaskStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "blocked"
  | "unsupported";
type ScoreImpactStatus = "none" | "pending_execution" | "applied" | "skipped";

interface InboxTask {
  id: string;
  platform: Platform;
  event_type: string;
  task_type: string;
  status: TaskStatus;
  priority: number;
  actor_display: string | null;
  actor_ref: string;
  content_excerpt: string | null;
  source_url: string | null;
  suggested_reply: string | null;
  lead_id?: string | null;
  score_impact_status?: ScoreImpactStatus;
  score_delta_points?: number | null;
  score_impact_reason?: string | null;
  latest_execution_attempt_id?: string | null;
  updated_at: string;
}

interface WatchlistItem {
  id: string;
  platform: Platform;
  external_profile_ref: string;
  priority: number;
  enabled: boolean;
  lead_id: string | null;
}

interface ListInboxResponse {
  items: InboxTask[];
}

interface ListWatchlistsResponse {
  items: WatchlistItem[];
}

export default function UnifiedInbox() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [newWatchPlatform, setNewWatchPlatform] = useState<Platform>("instagram");
  const [newWatchRef, setNewWatchRef] = useState("");
  const [newWatchLeadId, setNewWatchLeadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyWatchId, setBusyWatchId] = useState<string | null>(null);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const taskParams = new URLSearchParams();
      if (statusFilter) taskParams.set("status", statusFilter);
      if (platformFilter) taskParams.set("platform", platformFilter);
      taskParams.set("limit", "200");
      const [taskRes, watchRes] = await Promise.all([
        apiFetch<ListInboxResponse>(`/inbox/tasks?${taskParams.toString()}`, { method: "GET" }),
        apiFetch<ListWatchlistsResponse>("/watchlists", { method: "GET" }),
      ]);
      setTasks(taskRes.items);
      setWatchlists(watchRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unified inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [statusFilter, platformFilter]);

  async function approveTask(id: string) {
    setBusyTaskId(id);
    try {
      await apiFetch(`/inbox/tasks/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve task");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function rejectTask(id: string) {
    setBusyTaskId(id);
    try {
      await apiFetch(`/inbox/tasks/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by operator" }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject task");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function executeTask(id: string) {
    setBusyTaskId(id);
    try {
      await apiFetch(`/inbox/tasks/${id}/execute`, { method: "POST", body: JSON.stringify({}) });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute task");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function createWatchlist() {
    if (!newWatchRef.trim()) {
      setError("Profile ref is required");
      return;
    }
    setBusyWatchId("new");
    try {
      await apiFetch("/watchlists", {
        method: "POST",
        body: JSON.stringify({
          platform: newWatchPlatform,
          external_profile_ref: newWatchRef.trim(),
          lead_id: newWatchLeadId.trim() || undefined,
          enabled: true,
          priority: 50,
        }),
      });
      setNewWatchRef("");
      setNewWatchLeadId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist item");
    } finally {
      setBusyWatchId(null);
    }
  }

  async function toggleWatchlist(item: WatchlistItem) {
    setBusyWatchId(item.id);
    try {
      await apiFetch(`/watchlists/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update watchlist");
    } finally {
      setBusyWatchId(null);
    }
  }

  async function deleteWatchlist(id: string) {
    setBusyWatchId(id);
    try {
      await apiFetch(`/watchlists/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete watchlist");
    } finally {
      setBusyWatchId(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading unified inbox…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Unified Inbox</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review lead activity tasks, approve safe actions, and execute through DO-Socials.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="p-4 space-y-4">
        <h3 className="font-medium">Task filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Input
              id="status-filter"
              placeholder="pending, approved, blocked..."
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-filter">Platform</Label>
            <Input
              id="platform-filter"
              placeholder="facebook, instagram, whatsapp"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void loadData()}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">{task.platform}</Badge>
              <Badge variant="secondary">{task.status}</Badge>
              <Badge variant="default">{task.task_type}</Badge>
              {task.score_impact_status && task.score_impact_status !== "none" && (
                <Badge variant={task.score_impact_status === "applied" ? "default" : "outline"}>
                  score {task.score_impact_status}
                  {typeof task.score_delta_points === "number" ? ` (${task.score_delta_points > 0 ? "+" : ""}${task.score_delta_points})` : ""}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Priority {task.priority} · {new Date(task.updated_at).toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-medium">{task.actor_display ?? task.actor_ref}</p>
            <p className="text-sm text-muted-foreground">{task.content_excerpt ?? "No excerpt provided"}</p>
            {(task.score_impact_reason || task.lead_id || task.latest_execution_attempt_id) && (
              <p className="text-xs text-muted-foreground">
                {task.score_impact_reason ? `Impact: ${task.score_impact_reason}` : "Impact: n/a"}
                {task.lead_id ? ` · lead ${task.lead_id}` : " · no lead"}
                {task.latest_execution_attempt_id ? ` · execution ${task.latest_execution_attempt_id}` : ""}
              </p>
            )}
            {task.source_url && (
              <a className="text-xs underline text-blue-600" href={task.source_url} target="_blank" rel="noreferrer">
                Open source
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busyTaskId === task.id || task.status !== "pending"}
                onClick={() => void approveTask(task.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyTaskId === task.id || task.status === "rejected" || task.status === "executed"}
                onClick={() => void rejectTask(task.id)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={
                  busyTaskId === task.id ||
                  (task.status !== "approved" && task.status !== "failed" && task.status !== "blocked")
                }
                onClick={() => void executeTask(task.id)}
              >
                Execute
              </Button>
            </div>
          </Card>
        ))}
        {!tasks.length && <p className="text-sm text-muted-foreground">No tasks found.</p>}
      </div>

      <Card className="p-4 space-y-4">
        <h3 className="font-medium">Watchlist</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label htmlFor="watch-platform">Platform</Label>
            <select
              id="watch-platform"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={newWatchPlatform}
              onChange={(e) => setNewWatchPlatform(e.target.value as Platform)}
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="watch-ref">Profile ref</Label>
            <Input
              id="watch-ref"
              placeholder="platform profile id / handle"
              value={newWatchRef}
              onChange={(e) => setNewWatchRef(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="watch-lead">Lead id (optional)</Label>
            <Input
              id="watch-lead"
              placeholder="marketing lead UUID"
              value={newWatchLeadId}
              onChange={(e) => setNewWatchLeadId(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button disabled={busyWatchId === "new"} onClick={() => void createWatchlist()}>
              Add watch
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {watchlists.map((item) => (
            <div key={item.id} className="flex items-center justify-between border rounded-md p-2">
              <div className="text-sm">
                <span className="font-medium">{item.platform}</span> · {item.external_profile_ref}
                <span className="text-xs text-muted-foreground ml-2">
                  {item.enabled ? "enabled" : "disabled"} · priority {item.priority}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyWatchId === item.id} onClick={() => void toggleWatchlist(item)}>
                  {item.enabled ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="outline" disabled={busyWatchId === item.id} onClick={() => void deleteWatchlist(item.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!watchlists.length && <p className="text-sm text-muted-foreground">No watchlist entries yet.</p>}
        </div>
      </Card>
    </div>
  );
}
