import { describe, expect, it } from "bun:test";
import { resolveIdentifyPersistenceMode } from "./identify";

describe("identify persistence mode resolution", () => {
  it("converts anonymous lead in place for same-session identify", () => {
    const mode = resolveIdentifyPersistenceMode({
      emailProvided: true,
      hasExistingLead: false,
      hasExistingAnonymousLead: true,
    });

    expect(mode).toBe("convert_anonymous_lead_in_place");
  });

  it("updates existing email lead when one already exists", () => {
    const mode = resolveIdentifyPersistenceMode({
      emailProvided: true,
      hasExistingLead: true,
      hasExistingAnonymousLead: true,
    });

    expect(mode).toBe("update_existing_email_lead");
  });

  it("inserts a new lead when no candidates exist", () => {
    const mode = resolveIdentifyPersistenceMode({
      emailProvided: true,
      hasExistingLead: false,
      hasExistingAnonymousLead: false,
    });

    expect(mode).toBe("insert_new_lead");
  });
});
