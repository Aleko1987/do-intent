import { getAuthData as _getAuthData } from "encore.dev/internal/codegen/auth";
import { auth as _auth_auth } from "../../../auth\\auth.js";

export type AuthData = Awaited<ReturnType<typeof _auth_auth>>;

export function getAuthData(): AuthData | null {
    return _getAuthData()
}

declare module "encore.dev/api" {
  interface CallOpts {
    authData?: AuthData;
  }
}

