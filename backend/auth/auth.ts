import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";

export const ClerkSecretKey = secret("ClerkSecretKey");

// Lazy initialization of Clerk client to avoid reading secret at import time
let clerkClient: ReturnType<typeof createClerkClient> | null = null;
function getClerkClient() {
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey: ClerkSecretKey() });
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
      const verifiedToken = await verifyToken(token, {
        secretKey: ClerkSecretKey(),
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
