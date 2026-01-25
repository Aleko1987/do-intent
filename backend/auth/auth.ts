import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { resolveClerkSecretKey } from "../internal/env_secrets";

// Lazy initialization of Clerk client to avoid reading secret at import time
let clerkClient: ReturnType<typeof createClerkClient> | null = null;
function getClerkClient() {
  if (!clerkClient) {
    const secretKey = resolveClerkSecretKey();
    if (!secretKey) {
      throw APIError.internal("Clerk secret key is not configured");
    }
    clerkClient = createClerkClient({ secretKey });
  }
  return clerkClient;
}

interface AuthParams {
  authorization?: Header<"Authorization">;
}

export interface AuthData {
  userID: string;
  imageUrl: string;
  email: string | null;
}

export const auth = authHandler<AuthParams, AuthData>(
  async (data) => {
    const token = data.authorization?.replace("Bearer ", "");
    if (!token) {
      throw APIError.unauthenticated("missing token");
    }

    try {
      const secretKey = resolveClerkSecretKey();
      if (!secretKey) {
        throw APIError.internal("Clerk secret key is not configured");
      }
      const verifiedToken = await verifyToken(token, {
        secretKey,
      });

      const user = await getClerkClient().users.getUser(verifiedToken.sub);
      return {
        userID: user.id,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0]?.emailAddress ?? null,
      };
    } catch (err) {
      throw APIError.unauthenticated("invalid token", err as Error);
    }
  }
);

export const gw = new Gateway({ authHandler: auth });
