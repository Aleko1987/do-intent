import { useCallback, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { CandidateSignal } from "~backend/marketing/candidate_signal_types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "manual_upload", label: "Manual upload" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
] as const;

const SIGNAL_TYPE_OPTIONS = [
  { value: "post_published", label: "Post published" },
  { value: "link_clicked", label: "Link clicked" },
  { value: "inbound_message", label: "Inbound message" },
  { value: "quote_requested", label: "Quote requested" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "purchase_made", label: "Purchase made" },
  { value: "other", label: "Other" },
] as const;

interface IngestResponse {
  candidate_signal: CandidateSignal;
  deduped: boolean;
}

interface AttachEvidenceResponse {
  candidate_signal: CandidateSignal;
}

interface ManualScreenshotIntakeProps {
  onSuccess: () => void;
}

export default function ManualScreenshotIntake({ onSuccess }: ManualScreenshotIntakeProps) {
  const { getToken } = useAuth();
  const [channel, setChannel] = useState<string>("instagram");
  const [signalType, setSignalType] = useState<string>("post_published");
  const [sourceRef, setSourceRef] = useState("");
  const [dedupeKey, setDedupeKey] = useState("");
  const [summary, setSummary] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [selectedFileData, setSelectedFileData] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrRun, setOcrRun] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const ingestFile = useCallback((file: File | null) => {
    setError(null);
    if (!file) {
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
      setOcrConfidence(null);
      setOcrRun(false);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPEG).");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setSelectedFileData(result);
        setSelectedFileName(file.name);
        setSelectedMimeType(file.type || null);
        setOcrConfidence(null);
        setOcrRun(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  async function handleRunOcr() {
    if (!selectedFileData) {
      setError("Add an image before running OCR.");
      return;
    }

    setError(null);
    setOcrBusy(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const {
          data: { text, confidence },
        } = await worker.recognize(selectedFileData);
        const cleaned = text.replace(/\s+\n/g, "\n").trim();
        setRawText(cleaned);
        if (!summary.trim() && cleaned) {
          const firstLine = cleaned.split("\n").find((l) => l.trim().length > 0) ?? cleaned;
          setSummary(firstLine.slice(0, 240));
        }
        setOcrConfidence(typeof confidence === "number" ? confidence : null);
        setOcrRun(true);
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleSubmit() {
    if (!selectedFileData) {
      setError("Attach a screenshot before submitting.");
      return;
    }

    const summaryTrim = summary.trim();
    const rawTrim = rawText.trim();
    const effectiveSummary =
      summaryTrim ||
      (rawTrim ? rawTrim.slice(0, 240) : "") ||
      "Manual screenshot intake";

    if (!rawTrim && !summaryTrim) {
      setError("Add a summary or raw text (run OCR or type manually).");
      return;
    }

    setError(null);
    setSubmitBusy(true);
    try {
      const capturedAt = new Date().toISOString();
      const metadata = {
        intake: "manual_screenshot",
        ocr_engine: ocrRun ? "tesseract.js" : null,
        ocr_confidence: ocrConfidence,
        ocr_captured_at: ocrRun ? capturedAt : null,
        original_file_name: selectedFileName,
      };

      const ingestPayload = {
        channel,
        source_type: "manual",
        source_ref: sourceRef.trim() || undefined,
        signal_type: signalType,
        summary: effectiveSummary,
        raw_text: rawTrim || undefined,
        dedupe_key: dedupeKey.trim() || undefined,
        metadata: JSON.stringify(metadata),
      };

      const ingestResult = await apiFetch<IngestResponse>("/marketing/candidate-signals", {
        method: "POST",
        body: JSON.stringify(ingestPayload),
      });

      const signalId = ingestResult.candidate_signal.id;

      const evidenceMetadata = JSON.stringify({
        ...metadata,
        source_note: "Operator manual screenshot intake",
      });

      await apiFetch<AttachEvidenceResponse>(
        `/marketing/candidate-signals/${signalId}/evidence`,
        {
          method: "POST",
          body: JSON.stringify({
            evidence_type: "screenshot",
            storage_kind: "inline",
            evidence_ref: selectedFileData,
            mime_type: selectedMimeType ?? undefined,
            metadata: evidenceMetadata,
          }),
        }
      );

      setSummary("");
      setRawText("");
      setSourceRef("");
      setDedupeKey("");
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
      setOcrConfidence(null);
      setOcrRun(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitBusy(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    ingestFile(file);
  }

  return (
    <Card className="p-4 space-y-4 border-dashed border-2 bg-muted/20">
      <div>
        <h3 className="text-lg font-semibold">Manual screenshot intake</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a platform screenshot, run OCR (optional), edit text, then submit to the review queue.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <p className="text-sm text-muted-foreground mb-2">Drag and drop an image here, or</p>
        <Input
          type="file"
          accept="image/*"
          className="cursor-pointer"
          onChange={(e) => ingestFile(e.target.files?.[0] ?? null)}
        />
        {selectedFileName && (
          <p className="text-xs text-muted-foreground mt-2">Selected: {selectedFileName}</p>
        )}
        {ocrConfidence != null && (
          <p className="text-xs text-muted-foreground mt-1">Last OCR confidence: {ocrConfidence.toFixed(1)}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="intake-channel">Channel</Label>
          <select
            id="intake-channel"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-signal-type">Signal type</Label>
          <select
            id="intake-signal-type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={signalType}
            onChange={(e) => setSignalType(e.target.value)}
          >
            {SIGNAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="intake-source-ref">Source ref (optional)</Label>
        <Input
          id="intake-source-ref"
          placeholder="Post URL or platform reference"
          value={sourceRef}
          onChange={(e) => setSourceRef(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="intake-dedupe">Dedupe key (optional)</Label>
        <Input
          id="intake-dedupe"
          placeholder="e.g. ig:POST_ID — avoids duplicate signals for the same post"
          value={dedupeKey}
          onChange={(e) => setDedupeKey(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="intake-summary">Summary</Label>
        <Textarea
          id="intake-summary"
          className="min-h-[72px]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Short headline for reviewers"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="intake-raw">Raw text (OCR or manual)</Label>
        <Textarea
          id="intake-raw"
          className="min-h-[120px] font-mono text-sm"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Full extracted or pasted text"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={!selectedFileData || ocrBusy} onClick={() => void handleRunOcr()}>
          {ocrBusy ? "Running OCR…" : "Run OCR"}
        </Button>
        <Button
          type="button"
          disabled={submitBusy || !selectedFileData}
          onClick={() => void handleSubmit()}
        >
          {submitBusy ? "Submitting…" : "Submit to review queue"}
        </Button>
      </div>
    </Card>
  );
}
