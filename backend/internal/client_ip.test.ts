import { describe, expect, it } from "bun:test";
import { extractClientIp, hashClientIp } from "./client_ip";

describe("client IP helpers", () => {
  it("extracts first forwarded IP", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
      socket: {
        remoteAddress: "10.0.0.1",
      },
    } as any;

    expect(extractClientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to remote address and normalizes mapped ipv4", () => {
    const req = {
      headers: {},
      socket: {
        remoteAddress: "::ffff:198.51.100.77",
      },
    } as any;

    expect(extractClientIp(req)).toBe("198.51.100.77");
  });

  it("hashes IP deterministically", () => {
    const first = hashClientIp("203.0.113.10");
    const second = hashClientIp("203.0.113.10");
    expect(first).toBe(second);
    expect(first?.length).toBe(64);
  });
});
