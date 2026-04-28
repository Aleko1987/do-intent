import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { repairMalformedOwnerContactImports } from "./owner_contact_directory_service";

interface RepairOwnerContactsResponse {
  scanned_rows: number;
  repaired_rows: number;
  created_rows: number;
}

// Repairs malformed single-row paste imports into separate contacts.
export const repairOwnerContactsDirectory = api<void, RepairOwnerContactsResponse>(
  { expose: true, method: "POST", path: "/marketing/owner-contacts/repair", auth: true },
  async () => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    return repairMalformedOwnerContactImports({
      ownerUserId: authData.userID,
      actorUserId: authData.userID,
    });
  }
);
