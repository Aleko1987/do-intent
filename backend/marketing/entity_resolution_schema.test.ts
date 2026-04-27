import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { APIError } from "encore.dev/api";
import {
  parseContactDirectoryListQuery,
  parseLeadCandidatesV2Json,
  parseOwnerContactPlatform,
  serializeLeadCandidatesV2,
} from "./entity_resolution_schema";

describe("entity_resolution_schema lead candidates", () => {
  it("parses and serializes valid v2 payload", () => {
    const parsed = parseLeadCandidatesV2Json(
      {
        schema_version: "v2",
        lead_candidates: [
          {
            candidate_id: "c1",
            intent_type: "quote_requested",
            confidence: 0.86,
            evidence_snippets: [{ source: "llm", text: "Requested quote for 50 units" }],
            next_action: "review",
            reasons: ["Buyer requested quote"],
            resolved_contact: null,
            resolution_candidates: [],
          },
        ],
        model_meta: {
          provider: "ollama",
          model: "llama3.1:8b",
          prompt_version: "local_extractor_v2",
          schema_version: "v2",
          elapsed_ms: 210,
          timeout_ms: 12000,
          fallback_used: false,
        },
        quality_flags: [],
      },
      undefined
    );

    assert.ok(parsed);
    assert.equal(parsed?.schema_version, "v2");
    assert.equal(parsed?.lead_candidates.length, 1);
    const serialized = serializeLeadCandidatesV2(parsed!);
    assert.equal(serialized.includes('"schema_version":"v2"'), true);
  });

  it("rejects invalid v2 json payload", () => {
    assert.throws(
      () => parseLeadCandidatesV2Json(undefined, '{"schema_version":"v1"}'),
      APIError
    );
  });
});

describe("entity_resolution_schema list query", () => {
  it("normalizes list query defaults", () => {
    const query = parseContactDirectoryListQuery({});
    assert.equal(query.limit, 50);
    assert.equal(query.search, null);
    assert.equal(query.includeInactive, false);
  });

  it("parses owner contact platform enum", () => {
    assert.equal(parseOwnerContactPlatform("instagram"), "instagram");
    assert.throws(() => parseOwnerContactPlatform("x"), APIError);
  });
});
