import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { APIError } from "encore.dev/api";
import { checkBearerToken, parseCaptureIntakePayload } from "./capture_intake";

describe("capture_intake payload validation", () => {
  it("parses valid v1 payload", () => {
    const payload = parseCaptureIntakePayload({
      version: "v1",
      idempotency_key: "key-1",
      owner_user_id: "user_1",
      channel: "instagram",
      signal_type: "post_published",
      summary: "summary",
      raw_text: "raw",
      image_data_url: "data:image/png;base64,aGVsbG8=",
      mime_type: "image/png",
      metadata: {
        source: "hotkey_capture",
        capture_mode: "region",
        captured_at: "2026-04-26T10:00:00.000Z",
      },
    });

    assert.equal(payload.version, "v1");
    assert.equal(payload.metadata.capture_mode, "region");
    assert.equal(payload.idempotency_key, "key-1");
  });

  it("rejects invalid payload shape", () => {
    assert.throws(
      () =>
      parseCaptureIntakePayload({
        version: "v1",
        idempotency_key: "key",
        owner_user_id: "user_1",
      }),
      APIError
    );
  });
});

describe("capture_intake bearer auth", () => {
  it("accepts exact bearer token", () => {
    assert.equal(checkBearerToken("Bearer token123", "token123"), true);
  });

  it("rejects missing and mismatched token", () => {
    assert.equal(checkBearerToken(undefined, "token123"), false);
    assert.equal(checkBearerToken("Bearer no", "token123"), false);
  });
});
