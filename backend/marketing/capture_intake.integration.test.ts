import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { CandidateSignal, CandidateSignalEvidence } from "./candidate_signal_types";
import { createCaptureIntakeHandler } from "./capture_intake";

function buildSignal(id: string): CandidateSignal {
  const now = new Date().toISOString();
  return {
    id,
    owner_user_id: "user_1",
    channel: "instagram",
    source_type: "operator",
    source_ref: null,
    external_account_ref: null,
    lead_id: null,
    anonymous_id: null,
    signal_type: "other",
    summary: "Hotkey capture",
    raw_text: null,
    actor_display: null,
    actor_handle: null,
    identity_status: "unknown",
    identity_confidence: 0.4,
    identity_key_hash: null,
    suggested_event_type: "other",
    suggested_intent_score: null,
    suggested_stage: null,
    suggested_reason: null,
    suggestion_confidence: 0.4,
    status: "pending_review",
    promoted_event_id: null,
    dedupe_key: "idemp-1",
    metadata: {},
    occurred_at: now,
    last_reviewed_at: null,
    created_at: now,
    updated_at: now,
  };
}

function buildEvidence(id: string, signalId: string): CandidateSignalEvidence {
  const now = new Date().toISOString();
  return {
    id,
    candidate_signal_id: signalId,
    reminder_id: null,
    evidence_type: "screenshot",
    storage_kind: "inline",
    evidence_ref: "data:image/png;base64,aGVsbG8=",
    mime_type: "image/png",
    sha256: null,
    captured_at: now,
    redaction_status: "not_required",
    is_sensitive: true,
    metadata: {},
    created_by_user_id: "user_1",
    created_at: now,
  };
}

describe("POST /marketing/capture-intake", () => {
  let dedupeSeen = false;
  const server = createServer(
    createCaptureIntakeHandler({
      resolveToken: () => "capture-token",
      createSignal: async () => {
        if (!dedupeSeen) {
          dedupeSeen = true;
          return { candidateSignal: buildSignal("signal-1"), deduped: false };
        }
        return { candidateSignal: buildSignal("signal-1"), deduped: true };
      },
      attachEvidence: async () => ({
        evidence: buildEvidence("evidence-1", "signal-1"),
        candidateSignal: buildSignal("signal-1"),
      }),
    })
  );

  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const payload = {
    version: "v1",
    idempotency_key: "idemp-1",
    owner_user_id: "user_1",
    channel: "instagram",
    signal_type: "other",
    summary: "capture",
    raw_text: null,
    image_data_url: "data:image/png;base64,aGVsbG8=",
    mime_type: "image/png",
    metadata: {
      source: "hotkey_capture",
      capture_mode: "fullscreen",
      captured_at: "2026-04-26T10:00:00.000Z",
      ocr_text: "Jane from Acme asked for quote",
      ocr_confidence: 92.5,
      ocr_engine: "tesseract.js",
      llm_provider: "ollama",
      llm_model: "llama3.1:8b",
      llm_confidence: 0.82,
      lead_suggestion: {
        company_name: "Acme",
        contact_name: "Jane",
      },
      suggestion_state: "suggested",
    },
  };

  it("rejects unauthenticated requests", async () => {
    const response = await fetch(`${baseUrl}/marketing/capture-intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 401);
  });

  it("creates candidate signal and evidence on success", async () => {
    const response = await fetch(`${baseUrl}/marketing/capture-intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer capture-token",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok: boolean;
      deduped: boolean;
      evidence_id: string | null;
    };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.deduped, false);
    assert.equal(body.evidence_id, "evidence-1");
  });

  it("dedupes duplicate idempotency keys", async () => {
    const response = await fetch(`${baseUrl}/marketing/capture-intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer capture-token",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok: boolean;
      deduped: boolean;
      evidence_id: string | null;
    };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.deduped, true);
    assert.equal(body.evidence_id, null);
  });

  it("rejects malformed lead suggestion JSON", async () => {
    const response = await fetch(`${baseUrl}/marketing/capture-intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer capture-token",
      },
      body: JSON.stringify({
        ...payload,
        idempotency_key: "idemp-2",
        metadata: {
          ...payload.metadata,
          lead_suggestion_json: "{broken",
        },
      }),
    });
    assert.equal(response.status, 400);
  });
});
