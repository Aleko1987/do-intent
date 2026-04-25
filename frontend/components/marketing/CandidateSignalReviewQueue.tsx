import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type {
  CandidateSignal,
  CandidateSignalQueueItem,
  CandidateSignalReminder,
} from "~backend/marketing/candidate_signal_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ManualScreenshotIntake from "@/components/marketing/ManualScreenshotIntake";

const CHANNEL_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  facebook: "default",
  instagram: "secondary",
  whatsapp: "outline",
  email: "secondary",
  website: "default",
  manual_upload: "outline",
};

interface ListCandidateSignalsResponse {
  items: CandidateSignalQueueItem[];
}

interface RequestReminderResponse {
  reminder: CandidateSignalReminder;
  candidate_signal: CandidateSignal;
  whatsapp_message_url: string;
}

interface AttachEvidenceResponse {
  candidate_signal: CandidateSignal;
}

function formatMaybeNumber(value: unknown): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "n/a";
}

export default function CandidateSignalReviewQueue() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<CandidateSignalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeReminder, setActiveReminder] = useState<CandidateSignalReminder | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [selectedFileData, setSelectedFileData] = useState<string | null>(null);

  useEffect(() => {
    void loadQueue();
  }, []);

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

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ListCandidateSignalsResponse>("/marketing/candidate-signals?limit=100", {
        method: "GET",
      });
      setRows(response.items);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load candidate signal queue");
    } finally {
      setLoading(false);
    }
  }

  const activeRow = useMemo(() => rows.find((row) => row.id === activeId) ?? null, [rows, activeId]);

  async function handleRequestEvidence(row: CandidateSignalQueueItem) {
    setBusyId(row.id);
    try {
      const response = await apiFetch<RequestReminderResponse>(`/marketing/candidate-signals/${row.id}/reminders`, {
        method: "POST",
        body: JSON.stringify({ channel: "whatsapp" }),
      });
      setActiveId(row.id);
      setActiveReminder(response.reminder);
      setTemplateText(response.reminder.template_text);
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item)));
      window.open(response.whatsapp_message_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to request evidence reminder");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAttachEvidence(row: CandidateSignalQueueItem) {
    const evidenceRef = selectedFileData ?? evidenceUrl.trim();
    if (!evidenceRef) {
      setError("Attach a screenshot file or provide an evidence URL/path.");
      return;
    }

    setBusyId(row.id);
    try {
      const metadata = selectedFileName
        ? JSON.stringify({
            source_note: "Operator uploaded WhatsApp reply screenshot manually",
            original_file_name: selectedFileName,
          })
        : JSON.stringify({ source_note: "Operator linked WhatsApp reply evidence reference" });

      const response = await apiFetch<AttachEvidenceResponse>(`/marketing/candidate-signals/${row.id}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          reminder_id: activeReminder?.id,
          evidence_type: "screenshot",
          storage_kind: selectedFileData ? "inline" : "external_url",
          evidence_ref: evidenceRef,
          mime_type: selectedMimeType ?? undefined,
          metadata,
        }),
      });

      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item)));
      setEvidenceUrl("");
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to attach evidence");
    } finally {
      setBusyId(null);
    }
  }

  function onFileChange(file: File | null) {
    if (!file) {
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setSelectedFileData(result);
        setSelectedFileName(file.name);
        setSelectedMimeType(file.type || null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function copyTemplate() {
    if (!templateText) return;
    await navigator.clipboard.writeText(templateText);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading review queue…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Candidate Signal Review Queue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Human review is mandatory before promotion to canonical intent events.
        </p>
      </div>

      <ManualScreenshotIntake onSuccess={() => void loadQueue()} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{row.actor_display ?? row.actor_handle ?? "Unknown actor"}</span>
                  <Badge variant={CHANNEL_BADGE_VARIANTS[row.channel] ?? "outline"}>{row.channel}</Badge>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{row.summary ?? row.raw_text ?? "No summary provided"}</p>
                <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <span>Matched lead: {row.lead_id ?? "Unknown"}</span>
                  <span>Suggested event: {row.suggested_event_type ?? "other"}</span>
                  <span>Suggested score: {formatMaybeNumber(row.suggested_intent_score)}</span>
                  <span>Confidence: {formatMaybeNumber(row.suggestion_confidence)}</span>
                  <span>Evidence count: {row.evidence_count}</span>
                  <span>Reminder status: {row.latest_reminder_status ?? "none"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:w-[360px] md:justify-end">
                <Button size="sm" variant="outline" onClick={() => setActiveId(row.id)}>
                  Open Evidence Flow
                </Button>
                <Button size="sm" onClick={() => void handleRequestEvidence(row)} disabled={busyId === row.id}>
                  Request Evidence
                </Button>
              </div>
            </div>

            {activeId === row.id && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Phase 1: WhatsApp Reminder</p>
                  <textarea
                    className="w-full min-h-[80px] border rounded-md px-3 py-2 text-sm bg-background"
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder="Generate a reminder first, then copy/edit text before sending in WhatsApp"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void copyTemplate()} disabled={!templateText}>
                      Copy Template
                    </Button>
                    {activeReminder && (
                      <span className="text-xs text-muted-foreground self-center">
                        Reminder: {activeReminder.delivery_status} at {new Date(activeReminder.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Phase 2: Attach Reply Screenshot Evidence</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  />
                  {selectedFileName && (
                    <p className="text-xs text-muted-foreground">Prepared file: {selectedFileName}</p>
                  )}
                  <Input
                    placeholder="Or paste a secure evidence URL/path"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleAttachEvidence(row)}
                    disabled={busyId === row.id || (!selectedFileData && !evidenceUrl.trim())}
                  >
                    Attach Evidence
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {!rows.length && <p className="text-sm text-muted-foreground">No candidate signals found.</p>}
      {activeRow && (
        <Button size="sm" variant="secondary" onClick={() => void loadQueue()}>
          Refresh Queue
        </Button>
      )}
    </div>
  );
}
