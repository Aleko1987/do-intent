import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { serveMarketingIngestIntent } from "./ingest_intent_event";

describe("POST /marketing/ingest-intent-event authentication", () => {
  const originalIngestApiKey = process.env.INGEST_API_KEY;
  const originalEnableDb = process.env.ENABLE_DB;

  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/marketing/ingest-intent-event") {
      void serveMarketingIngestIntent(req, res);
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  let baseUrl = "";

  beforeAll(async () => {
    process.env.INGEST_API_KEY = "test-ingest-key";
    process.env.ENABLE_DB = "false";

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (originalIngestApiKey === undefined) {
      delete process.env.INGEST_API_KEY;
    } else {
      process.env.INGEST_API_KEY = originalIngestApiKey;
    }

    if (originalEnableDb === undefined) {
      delete process.env.ENABLE_DB;
    } else {
      process.env.ENABLE_DB = originalEnableDb;
    }
  });

  it("returns 401 when x-do-intent-key header is missing", async () => {
    const response = await fetch(`${baseUrl}/marketing/ingest-intent-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "page_view",
        anonymous_id: "anon_123",
        path: "/pricing",
      }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 200 when x-do-intent-key header is present", async () => {
    const response = await fetch(`${baseUrl}/marketing/ingest-intent-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-do-intent-key": "test-ingest-key",
      },
      body: JSON.stringify({
        event_type: "page_view",
        anonymous_id: "anon_456",
        path: "/pricing",
      }),
    });

    expect(response.status).toBe(200);
  });
});
