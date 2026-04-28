import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import {
  parseOwnerContactImportMode,
  parseOwnerContactInputFormat,
  parseOwnerContactPayloadText,
  parseOwnerContactPlatform,
  parseOwnerContactScopeType,
  parseOwnerContactSource,
  truncateImportErrors,
} from "./entity_resolution_schema";
import { importOwnerContacts } from "./owner_contact_directory_service";

interface ImportOwnerContactsRequest {
  source: "csv_upload" | "paste_text" | "api_refresh";
  platform: "instagram" | "facebook" | "whatsapp" | "email" | "website" | "manual_upload" | "unknown";
  owner_scope_type?: "workspace_owner" | "connected_account";
  owner_scope_ref?: string;
  owner_scope_label?: string;
  mode: "full_refresh" | "delta";
  format: "csv" | "text";
  payload: string;
  correlation_id?: string;
}

interface ImportOwnerContactsResponse {
  batch_id: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

// Imports owner-scoped contacts via CSV or pasted text.
export const importOwnerContactsDirectory = api<
  ImportOwnerContactsRequest,
  ImportOwnerContactsResponse
>({ expose: true, method: "POST", path: "/marketing/owner-contacts/import", auth: true }, async (req) => {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }

  const source = parseOwnerContactSource(req.source);
  const platform = parseOwnerContactPlatform(req.platform);
  const ownerScopeType = req.owner_scope_type ? parseOwnerContactScopeType(req.owner_scope_type) : "workspace_owner";
  const ownerScopeRefRaw = typeof req.owner_scope_ref === "string" ? req.owner_scope_ref.trim() : "";
  const ownerScopeLabelRaw = typeof req.owner_scope_label === "string" ? req.owner_scope_label.trim() : "";
  const mode = parseOwnerContactImportMode(req.mode);
  const format = parseOwnerContactInputFormat(req.format);
  const payload = parseOwnerContactPayloadText(req.payload);

  const imported = await importOwnerContacts({
    ownerUserId: authData.userID,
    actorUserId: authData.userID,
    source,
    platform,
    ownerScopeType,
    ownerScopeRef: ownerScopeRefRaw || authData.userID,
    ownerScopeLabel: ownerScopeLabelRaw || ownerScopeRefRaw || authData.userID,
    mode,
    format,
    payload,
    correlationId: req.correlation_id ?? null,
  });

  return {
    ...imported,
    errors: truncateImportErrors(imported.errors),
  };
});
