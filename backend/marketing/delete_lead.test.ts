import { describe, expect, it } from "bun:test";
import { resolveCorrelationId, SOFT_DELETE_LEAD_SQL } from "./delete_lead";

describe("marketing delete lead helpers", () => {
  it("uses correlation id header when provided", () => {
    const corr = resolveCorrelationId("  corr-123  ");
    expect(corr).toBe("corr-123");
  });

  it("generates correlation id when header missing", () => {
    const corr = resolveCorrelationId(undefined);
    expect(corr.length).toBeGreaterThan(0);
    expect(corr).toContain("-");
  });

  it("soft delete SQL scopes by owner and non-deleted rows", () => {
    expect(SOFT_DELETE_LEAD_SQL).toContain("owner_user_id = $2");
    expect(SOFT_DELETE_LEAD_SQL).toContain("deleted_at IS NULL");
    expect(SOFT_DELETE_LEAD_SQL).toContain("SET deleted_at = now()");
  });
});
