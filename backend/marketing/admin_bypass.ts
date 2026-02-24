import { APIError, Header } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { timingSafeEqual } from "crypto";
import { resolveMarketingAdminKey } from "../internal/env_secrets";

export interface MarketingAdminAuthRequest {
  "x-marketing-admin-key"?: Header<"x-marketing-admin-key">;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    const max = Math.max(aBuf.length, bBuf.length);
    const paddedA = Buffer.concat([aBuf, Buffer.alloc(max - aBuf.length)]);
    const paddedB = Buffer.concat([bBuf, Buffer.alloc(max - bBuf.length)]);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

export function resolveMarketingRequestUID(
  req: MarketingAdminAuthRequest,
  endpoint: string
): string {
  const configuredAdminKey = resolveMarketingAdminKey();
  const providedAdminKey = req["x-marketing-admin-key"]?.trim() ?? "";

  if (
    configuredAdminKey &&
    providedAdminKey &&
    constantTimeEquals(providedAdminKey, configuredAdminKey)
  ) {
    const ownerUID = process.env.WEBSITE_OWNER_USER_ID?.trim();
    if (!ownerUID) {
      throw APIError.failedPrecondition(
        "WEBSITE_OWNER_USER_ID must be set when using x-marketing-admin-key"
      );
    }

    console.info("[marketing.auth] admin bypass used", {
      bypass: true,
      uidUsed: ownerUID,
      endpoint,
    });

    return ownerUID;
  }

  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  return authData.userID;
}
