import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export type CorrelatedRequest = IncomingMessage & {
  correlationId?: string;
};

function readHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

export function applyCorrelationId(req: IncomingMessage, res: ServerResponse): string {
  const existing = readHeader(req, "x-correlation-id")?.trim();
  const correlationId = existing && existing.length > 0 ? existing : randomUUID();

  (req as CorrelatedRequest).correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  return correlationId;
}

