import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { OwnerContactDirectoryItem } from "./entity_resolution_contracts";
import { parseContactDirectoryListQuery } from "./entity_resolution_schema";
import { listOwnerContactDirectory } from "./owner_contact_directory_service";

interface ListOwnerContactDirectoryRequest {
  search?: string;
  limit?: number;
  include_inactive?: boolean;
}

interface ListOwnerContactDirectoryResponse {
  items: OwnerContactDirectoryItem[];
}

// Lists owner-scoped contact directory entries used by resolver.
export const listOwnerContacts = api<
  ListOwnerContactDirectoryRequest,
  ListOwnerContactDirectoryResponse
>({ expose: true, method: "GET", path: "/marketing/owner-contacts", auth: true }, async (req) => {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  const query = parseContactDirectoryListQuery(req);
  const items = await listOwnerContactDirectory({
    ownerUserId: authData.userID,
    search: query.search,
    limit: query.limit,
    includeInactive: query.includeInactive,
  });
  return { items };
});
