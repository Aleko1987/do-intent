import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLocalLlmExtraction, sanitizeSuggestion } from "./localLlmExtractor.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("sanitizeSuggestion", () => {
  it("sanitizes and bounds suggestion fields", () => {
    const suggestion = sanitizeSuggestion({
      company_name: "  ACME Inc  ",
      contact_name: " Jane Doe ",
      email: "JANE@EXAMPLE.COM",
      phone: "+1 (555) 555-5555",
      reason: "Interested after campaign",
      suggested_event_type: "quote_requested",
      ignored: "x",
    });

    assert.deepEqual(suggestion, {
      company_name: "ACME Inc",
      contact_name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1 (555) 555-5555",
      reason: "Interested after campaign",
      suggested_event_type: "quote_requested",
    });
  });
});

describe("runLocalLlmExtraction", () => {
  it("returns sanitized suggestion from ollama JSON response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          response:
            '{"lead_suggestion":{"company_name":"Acme","contact_name":"Jane","email":"jane@acme.com","phone":"+15551234567","reason":"Requested quote","suggested_event_type":"quote_requested"},"llm_confidence":0.9}',
        }),
        { status: 200 }
      )) as typeof fetch;

    const result = await runLocalLlmExtraction({
      endpoint: "http://127.0.0.1:11434",
      model: "llama3.1:8b",
      timeoutMs: 2000,
      ocrText: "Need a quote for ACME",
      minConfidence: 0.35,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.provider, "ollama");
    assert.equal(result.model, "llama3.1:8b");
    assert.equal(result.confidence, 0.9);
    assert.equal(result.suggestion.company_name, "Acme");
  });

  it("returns empty suggestion when below confidence threshold", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          response:
            '{"lead_suggestion":{"company_name":"Acme"},"llm_confidence":0.2}',
        }),
        { status: 200 }
      )) as typeof fetch;

    const result = await runLocalLlmExtraction({
      endpoint: "http://127.0.0.1:11434",
      model: "llama3.1:8b",
      timeoutMs: 2000,
      ocrText: "Need a quote for ACME",
      minConfidence: 0.35,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.suggestion, {});
  });
});
