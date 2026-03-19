import { describe, expect, it } from "bun:test";
import {
  WEBSITE_OWNER_USER_ID_FALLBACK,
  resolveWebsiteOwnerUserId,
} from "./owner_user";

describe("resolveWebsiteOwnerUserId", () => {
  it("uses WEBSITE_OWNER_USER_ID when configured", () => {
    const original = process.env.WEBSITE_OWNER_USER_ID;
    process.env.WEBSITE_OWNER_USER_ID = "user_custom_owner";
    try {
      expect(resolveWebsiteOwnerUserId()).toBe("user_custom_owner");
    } finally {
      if (original === undefined) {
        delete process.env.WEBSITE_OWNER_USER_ID;
      } else {
        process.env.WEBSITE_OWNER_USER_ID = original;
      }
    }
  });

  it("falls back to stable website owner id when env missing", () => {
    const original = process.env.WEBSITE_OWNER_USER_ID;
    delete process.env.WEBSITE_OWNER_USER_ID;
    try {
      expect(resolveWebsiteOwnerUserId()).toBe(WEBSITE_OWNER_USER_ID_FALLBACK);
    } finally {
      if (original === undefined) {
        delete process.env.WEBSITE_OWNER_USER_ID;
      } else {
        process.env.WEBSITE_OWNER_USER_ID = original;
      }
    }
  });
});
