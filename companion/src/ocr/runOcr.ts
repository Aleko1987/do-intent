export interface OcrSuccess {
  ok: true;
  text: string;
  confidence: number | null;
  engine: string;
  capturedAt: string;
  elapsedMs: number;
}

export interface OcrFailure {
  ok: false;
  error: string;
  engine: string;
  capturedAt: string;
  elapsedMs: number;
}

export type OcrResult = OcrSuccess | OcrFailure;

export function normalizeOcrText(value: string): string {
  return value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeConfidence(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.slice(0, 512);
  }
  return "OCR failed";
}

export async function runOcrFromDataUrl(dataUrl: string): Promise<OcrResult> {
  const startedAt = Date.now();
  const capturedAt = new Date().toISOString();
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(dataUrl);
      const confidence = normalizeConfidence(result.data?.confidence);
      const text = normalizeOcrText(result.data?.text ?? "");
      return {
        ok: true,
        text,
        confidence,
        engine: "tesseract.js",
        capturedAt,
        elapsedMs: Date.now() - startedAt,
      };
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      engine: "tesseract.js",
      capturedAt,
      elapsedMs: Date.now() - startedAt,
    };
  }
}
