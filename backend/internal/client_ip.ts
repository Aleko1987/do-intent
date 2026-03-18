import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const first = trimmed.split(",")[0]?.trim() ?? "";
  if (!first) {
    return null;
  }

  if (first.startsWith("::ffff:")) {
    return first.slice("::ffff:".length);
  }

  return first;
}

export function extractClientIp(req: IncomingMessage): string | null {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string") {
    return normalizeIp(cf);
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return normalizeIp(realIp);
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return normalizeIp(forwardedFor);
  }

  const remote = req.socket?.remoteAddress ?? null;
  return normalizeIp(remote);
}

export function hashClientIp(ipRaw: string | null): string | null {
  const normalized = normalizeIp(ipRaw);
  if (!normalized) {
    return null;
  }

  const salt = process.env.IP_HASH_SALT?.trim();
  const stableInput = salt ? `${salt}:${normalized}` : normalized;
  return createHash("sha256").update(stableInput).digest("hex");
}

export function buildIpContext(req: IncomingMessage): {
  ipRaw: string | null;
  ipFingerprint: string | null;
} {
  const ipRaw = extractClientIp(req);
  const ipFingerprint = hashClientIp(ipRaw);
  return { ipRaw, ipFingerprint };
}
