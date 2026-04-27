import { APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { db } from "../db/db";
import type {
  LeadCandidatesPayloadV2,
  OwnerContactDirectoryItem,
  OwnerContactDirectoryRow,
  OwnerContactImportMode,
  OwnerContactInputFormat,
  OwnerContactPlatform,
  OwnerContactSource,
  ResolverAuditV2,
  ResolverDecision,
  ResolverMatchMethod,
} from "./entity_resolution_contracts";
import type { OwnerContactImportError } from "./entity_resolution_schema";

interface ParsedContactImportRecord {
  platform: OwnerContactPlatform;
  external_ref: string | null;
  display_name: string;
  aliases: string[];
  handles: Array<{ platform: string | null; value: string; normalized: string }>;
  emails: string[];
  phones: string[];
  source_updated_at: string | null;
  confidence_hint: number | null;
}

interface ImportOwnerContactsParams {
  ownerUserId: string;
  actorUserId: string;
  source: OwnerContactSource;
  platform: OwnerContactPlatform;
  mode: OwnerContactImportMode;
  format: OwnerContactInputFormat;
  payload: string;
  correlationId?: string | null;
}

interface ImportOwnerContactsResult {
  batch_id: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  errors: OwnerContactImportError[];
}

function normalizeImportedPlatform(value: string, fallback: OwnerContactPlatform): OwnerContactPlatform {
  const normalized = normalizeContactString(value);
  if (
    normalized === "instagram" ||
    normalized === "facebook" ||
    normalized === "whatsapp" ||
    normalized === "email" ||
    normalized === "website" ||
    normalized === "manual_upload"
  ) {
    return normalized;
  }
  return fallback;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeContactString(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.+_ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHandle(value: string): string {
  return normalizeContactString(value).replace(/^@+/, "");
}

function normalizePhone(value: string): string {
  const kept = value.replace(/[^\d+]/g, "");
  if (!kept) return "";
  if (kept.startsWith("+")) {
    return `+${kept.slice(1).replace(/[^\d]/g, "")}`;
  }
  return kept.replace(/[^\d]/g, "");
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseDelimitedList(value: string): string[] {
  return value
    .split(/[;|]/g)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 0);
}

function parseHandleList(
  value: string,
  defaultPlatform: OwnerContactPlatform
): ParsedContactImportRecord["handles"] {
  const handles: ParsedContactImportRecord["handles"] = [];
  for (const item of parseDelimitedList(value)) {
    const [platformRaw, handleRaw] = item.includes(":")
      ? item.split(":", 2)
      : [null, item];
    const normalized = normalizeHandle(handleRaw ?? "");
    if (!normalized) continue;
    handles.push({
      platform: platformRaw ? normalizeContactString(platformRaw).slice(0, 32) : defaultPlatform,
      value: normalizeWhitespace(handleRaw ?? "").slice(0, 96),
      normalized: normalized.slice(0, 96),
    });
  }
  return handles;
}

function parseEmailList(value: string): string[] {
  const emails: string[] = [];
  for (const item of parseDelimitedList(value)) {
    const normalized = normalizeContactString(item);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) continue;
    emails.push(normalized);
  }
  return Array.from(new Set(emails)).slice(0, 12);
}

function parsePhoneList(value: string): string[] {
  const phones: string[] = [];
  for (const item of parseDelimitedList(value)) {
    const normalized = normalizePhone(item);
    if (normalized.length < 6) continue;
    phones.push(normalized.slice(0, 32));
  }
  return Array.from(new Set(phones)).slice(0, 12);
}

function parseDateOrNull(value: string): string | null {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseConfidenceOrNull(value: string): number | null {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return Math.round(n * 1000) / 1000;
}

function parseRecordsFromCsv(
  payload: string,
  defaultPlatform: OwnerContactPlatform
): { rows: ParsedContactImportRecord[]; errors: OwnerContactImportError[] } {
  const lines = payload
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [] };
  }

  const header = parseCsvLine(lines[0]).map((column) => normalizeContactString(column));
  const index = (name: string): number => header.indexOf(name);

  const idxDisplay = index("display_name");
  if (idxDisplay === -1) {
    throw APIError.invalidArgument("CSV header must include display_name");
  }

  const idxExternalRef = index("external_ref");
  const idxPlatform = index("platform");
  const idxAliases = index("aliases");
  const idxHandles = index("handles");
  const idxEmails = index("emails");
  const idxPhones = index("phones");
  const idxSourceUpdatedAt = index("source_updated_at");
  const idxConfidenceHint = index("confidence_hint");

  const rows: ParsedContactImportRecord[] = [];
  const errors: OwnerContactImportError[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const values = parseCsvLine(lines[i]);
    const displayName = normalizeWhitespace(values[idxDisplay] ?? "");
    if (!displayName) {
      errors.push({ row: rowNumber, reason: "display_name is required" });
      continue;
    }

    const parsed: ParsedContactImportRecord = {
      platform:
        idxPlatform >= 0 && normalizeContactString(values[idxPlatform] ?? "")
          ? normalizeImportedPlatform(values[idxPlatform] ?? "", defaultPlatform)
          : defaultPlatform,
      external_ref: normalizeWhitespace(values[idxExternalRef] ?? "") || null,
      display_name: displayName.slice(0, 180),
      aliases: parseDelimitedList(values[idxAliases] ?? "").slice(0, 12),
      handles: parseHandleList(values[idxHandles] ?? "", defaultPlatform).slice(0, 12),
      emails: parseEmailList(values[idxEmails] ?? ""),
      phones: parsePhoneList(values[idxPhones] ?? ""),
      source_updated_at: parseDateOrNull(values[idxSourceUpdatedAt] ?? ""),
      confidence_hint: parseConfidenceOrNull(values[idxConfidenceHint] ?? ""),
    };
    rows.push(parsed);
  }
  return { rows, errors };
}

function parseRecordsFromText(
  payload: string,
  defaultPlatform: OwnerContactPlatform
): { rows: ParsedContactImportRecord[]; errors: OwnerContactImportError[] } {
  const lines = payload
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: ParsedContactImportRecord[] = [];
  const errors: OwnerContactImportError[] = [];

  lines.forEach((line, index) => {
    const row = index + 1;
    const emailMatch = line.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/);
    const handleMatches = Array.from(line.matchAll(/@([A-Za-z0-9._-]{2,40})/g));
    const phoneMatch = line.match(/\+?\d[\d()\-\s]{5,20}\d/g);

    const cleanedName = normalizeWhitespace(
      line
        .replace(emailMatch?.[0] ?? "", "")
        .replace(phoneMatch?.[0] ?? "", "")
        .replace(/@([A-Za-z0-9._-]{2,40})/g, "")
        .replace(/[|,;]+/g, " ")
    );

    if (!cleanedName) {
      errors.push({ row, reason: "could not infer display name from line" });
      return;
    }

    const handles = handleMatches
      .map((match) => ({
        platform: defaultPlatform,
        value: `@${match[1]}`,
        normalized: normalizeHandle(match[1]).slice(0, 96),
      }))
      .filter((handle) => handle.normalized.length > 0);

    rows.push({
      platform: defaultPlatform,
      external_ref: null,
      display_name: cleanedName.slice(0, 180),
      aliases: [],
      handles,
      emails: emailMatch ? parseEmailList(emailMatch[0]) : [],
      phones: phoneMatch ? parsePhoneList(phoneMatch[0]) : [],
      source_updated_at: null,
      confidence_hint: null,
    });
  });

  return { rows, errors };
}

function parseImportRecords(
  format: OwnerContactInputFormat,
  platform: OwnerContactPlatform,
  payload: string
): { rows: ParsedContactImportRecord[]; errors: OwnerContactImportError[] } {
  if (format === "csv") {
    return parseRecordsFromCsv(payload, platform);
  }
  return parseRecordsFromText(payload, platform);
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseJsonHandleArray(value: unknown): OwnerContactDirectoryItem["handles"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      if (typeof record.value !== "string" || typeof record.normalized !== "string") {
        return null;
      }
      return {
        platform: typeof record.platform === "string" ? record.platform : null,
        value: record.value,
        normalized: record.normalized,
      };
    })
    .filter((entry): entry is OwnerContactDirectoryItem["handles"][number] => Boolean(entry));
}

function normalizeContactRow(row: OwnerContactDirectoryRow): OwnerContactDirectoryItem {
  return {
    id: row.id,
    source: row.source,
    platform: row.platform,
    external_ref: row.external_ref,
    display_name: row.display_name,
    normalized_name: row.normalized_name,
    aliases: parseJsonStringArray(row.aliases),
    handles: parseJsonHandleArray(row.handles),
    emails: parseJsonStringArray(row.emails),
    phones: parseJsonStringArray(row.phones),
    confidence_hint: row.confidence_hint,
    is_active: row.is_active,
    source_updated_at: row.source_updated_at,
    updated_at: row.updated_at,
  };
}

export async function listOwnerContactDirectory(params: {
  ownerUserId: string;
  search: string | null;
  limit: number;
  includeInactive: boolean;
  platform: OwnerContactPlatform | null;
}): Promise<OwnerContactDirectoryItem[]> {
  const queryParams: unknown[] = [params.ownerUserId];
  const where: string[] = ["owner_user_id = $1"];

  if (!params.includeInactive) {
    where.push("is_active = true");
  }
  if (params.platform) {
    queryParams.push(params.platform);
    where.push(`platform = $${queryParams.length}`);
  }
  if (params.search) {
    queryParams.push(`%${normalizeContactString(params.search)}%`);
    where.push(`(normalized_name LIKE $${queryParams.length} OR display_name ILIKE $${queryParams.length})`);
  }
  queryParams.push(params.limit);

  const rows = await db.rawQueryAll<OwnerContactDirectoryRow>(
    `
      SELECT *
      FROM owner_contact_directory
      WHERE ${where.join(" AND ")}
      ORDER BY is_active DESC, updated_at DESC
      LIMIT $${queryParams.length}
    `,
    ...queryParams
  );

  return rows.map(normalizeContactRow);
}

export async function importOwnerContacts(params: ImportOwnerContactsParams): Promise<ImportOwnerContactsResult> {
  const parsed = parseImportRecords(params.format, params.platform, params.payload);
  const acceptedRows = parsed.rows;
  const rejectedRows = parsed.errors.length;
  const totalRows = acceptedRows.length + rejectedRows;
  const batchId = randomUUID();

  await db.exec`
    INSERT INTO owner_contact_import_batches (
      id,
      owner_user_id,
      source,
      platform,
      mode,
      input_format,
      total_rows,
      accepted_rows,
      rejected_rows,
      parse_errors,
      actor_user_id,
      correlation_id,
      created_at
    ) VALUES (
      ${batchId},
      ${params.ownerUserId},
      ${params.source},
      ${params.platform},
      ${params.mode},
      ${params.format},
      ${totalRows},
      ${acceptedRows.length},
      ${rejectedRows},
      ${JSON.stringify(parsed.errors)},
      ${params.actorUserId},
      ${params.correlationId ?? null},
      now()
    )
  `;

  if (params.mode === "full_refresh") {
    await db.exec`
      UPDATE owner_contact_directory
      SET
        is_active = false,
        import_batch_id = ${batchId},
        updated_at = now()
      WHERE owner_user_id = ${params.ownerUserId}
        AND source = ${params.source}
        AND platform = ${params.platform}
        AND is_active = true
    `;
  }

  for (const row of acceptedRows) {
    const normalizedName = normalizeContactString(row.display_name);
    if (!normalizedName) {
      continue;
    }

    const matchedByExternalRef =
      row.external_ref &&
      (await db.queryRow<{ id: string }>`
        SELECT id
        FROM owner_contact_directory
        WHERE owner_user_id = ${params.ownerUserId}
          AND source = ${params.source}
          AND platform IS NOT DISTINCT FROM ${row.platform}
          AND external_ref = ${row.external_ref}
      `);

    const matchedByName = matchedByExternalRef
      ? null
      : await db.queryRow<{ id: string }>`
          SELECT id
          FROM owner_contact_directory
          WHERE owner_user_id = ${params.ownerUserId}
            AND source = ${params.source}
            AND platform IS NOT DISTINCT FROM ${row.platform}
            AND normalized_name = ${normalizedName}
          ORDER BY updated_at DESC
          LIMIT 1
        `;

    const targetId = matchedByExternalRef?.id ?? matchedByName?.id ?? null;
    if (targetId) {
      await db.exec`
        UPDATE owner_contact_directory
        SET
          display_name = ${row.display_name},
          normalized_name = ${normalizedName},
          platform = ${row.platform},
          aliases = ${JSON.stringify(row.aliases)},
          handles = ${JSON.stringify(row.handles)},
          emails = ${JSON.stringify(row.emails)},
          phones = ${JSON.stringify(row.phones)},
          confidence_hint = ${row.confidence_hint},
          is_active = true,
          source_updated_at = ${row.source_updated_at},
          import_batch_id = ${batchId},
          updated_at = now(),
          external_ref = ${row.external_ref}
        WHERE id = ${targetId}
          AND owner_user_id = ${params.ownerUserId}
      `;
      continue;
    }

    await db.exec`
      INSERT INTO owner_contact_directory (
        owner_user_id,
        source,
        platform,
        external_ref,
        display_name,
        normalized_name,
        aliases,
        handles,
        emails,
        phones,
        confidence_hint,
        is_active,
        source_updated_at,
        import_batch_id,
        created_at,
        updated_at
      ) VALUES (
        ${params.ownerUserId},
        ${params.source},
        ${row.platform},
        ${row.external_ref},
        ${row.display_name},
        ${normalizedName},
        ${JSON.stringify(row.aliases)},
        ${JSON.stringify(row.handles)},
        ${JSON.stringify(row.emails)},
        ${JSON.stringify(row.phones)},
        ${row.confidence_hint},
        true,
        ${row.source_updated_at},
        ${batchId},
        now(),
        now()
      )
    `;
  }

  return {
    batch_id: batchId,
    total_rows: totalRows,
    accepted_rows: acceptedRows.length,
    rejected_rows: rejectedRows,
    errors: parsed.errors,
  };
}

interface ResolverCandidateInput {
  name: string | null;
  handles: string[];
  emails: string[];
  phones: string[];
}

interface ResolverMatchResult {
  contact: OwnerContactDirectoryItem;
  score: number;
  method: ResolverMatchMethod;
  feature_breakdown: {
    exact_name: number;
    exact_handle: number;
    exact_email: number;
    prefix_name: number;
    fuzzy_name: number;
    token_overlap: number;
  };
}

function tokenize(value: string): string[] {
  return normalizeContactString(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function jaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const a = new Set(tokensA);
  const b = new Set(tokensB);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, row) =>
    Array.from({ length: a.length + 1 }, (_, col) => {
      if (row === 0) return col;
      if (col === 0) return row;
      return 0;
    })
  );
  for (let row = 1; row <= b.length; row += 1) {
    for (let col = 1; col <= a.length; col += 1) {
      const cost = b[row - 1] === a[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function similarityByEditDistance(a: string, b: string): number {
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 0 : 1 - distance / maxLength;
}

function determineMethod(result: ResolverMatchResult["feature_breakdown"]): ResolverMatchMethod {
  if (result.exact_name > 0 || result.exact_handle > 0 || result.exact_email > 0) return "exact";
  if (result.prefix_name > 0) return "prefix";
  return "fuzzy";
}

function scoreContactMatch(contact: OwnerContactDirectoryItem, input: ResolverCandidateInput): ResolverMatchResult | null {
  const queryName = input.name ? normalizeContactString(input.name) : "";
  const queryTokens = tokenize(queryName);
  const contactTokens = tokenize(contact.display_name);
  const aliases = contact.aliases.map((alias) => normalizeContactString(alias));
  const candidateNames = [contact.normalized_name, ...aliases].filter(Boolean);

  const normalizedHandles = new Set(input.handles.map((handle) => normalizeHandle(handle)));
  const normalizedEmails = new Set(input.emails.map((email) => normalizeContactString(email)));
  const normalizedPhones = new Set(input.phones.map((phone) => normalizePhone(phone)));

  const exactName = queryName && candidateNames.includes(queryName) ? 1 : 0;
  const exactHandle =
    normalizedHandles.size > 0
      ? contact.handles.some((handle) => normalizedHandles.has(normalizeHandle(handle.normalized))) ? 1 : 0
      : 0;
  const exactEmail =
    normalizedEmails.size > 0
      ? contact.emails.some((email) => normalizedEmails.has(normalizeContactString(email))) ? 1 : 0
      : 0;
  const exactPhone =
    normalizedPhones.size > 0
      ? contact.phones.some((phone) => normalizedPhones.has(normalizePhone(phone))) ? 1 : 0
      : 0;
  const prefixName =
    queryName && candidateNames.some((name) => name.startsWith(queryName) || queryName.startsWith(name)) ? 1 : 0;
  const fuzzyName = Math.max(
    ...candidateNames.map((name) => similarityByEditDistance(name, queryName)),
    similarityByEditDistance(contact.normalized_name, queryName),
    0
  );
  const tokenOverlap = jaccard(queryTokens, contactTokens);

  const score = Math.max(
    exactName * 1.0 + exactHandle * 0.95 + exactEmail * 0.95 + exactPhone * 0.9,
    prefixName * 0.84 + tokenOverlap * 0.66 + fuzzyName * 0.72
  );
  if (score < 0.35) return null;

  const featureBreakdown = {
    exact_name: exactName,
    exact_handle: exactHandle,
    exact_email: exactEmail + exactPhone,
    prefix_name: prefixName,
    fuzzy_name: Math.round(fuzzyName * 1000) / 1000,
    token_overlap: Math.round(tokenOverlap * 1000) / 1000,
  };

  return {
    contact,
    score: Math.round(Math.min(score, 1) * 1000) / 1000,
    method: determineMethod(featureBreakdown),
    feature_breakdown: featureBreakdown,
  };
}

function buildResolverAudit(
  queryRaw: string,
  matches: ResolverMatchResult[],
  thresholds: { autoSelectMin: number; ambiguousMin: number }
): ResolverAuditV2 {
  const top = matches[0] ?? null;
  const second = matches[1] ?? null;
  let decision: ResolverDecision = "unresolved";
  if (top && top.score >= thresholds.autoSelectMin && (!second || top.score - second.score >= 0.08)) {
    decision = "resolved";
  } else if (top && top.score >= thresholds.ambiguousMin) {
    decision = "ambiguous";
  }

  return {
    version: "v2",
    strategy: "deterministic_token_similarity",
    query: {
      raw: queryRaw,
      normalized_tokens: tokenize(queryRaw),
      extracted_handles: queryRaw.match(/@([A-Za-z0-9._-]{2,40})/g)?.map((entry) => entry.slice(1)) ?? [],
    },
    matches: matches.slice(0, 5).map((match) => ({
      contact_id: match.contact.id,
      display_name: match.contact.display_name,
      score: match.score,
      method: match.method,
      feature_breakdown: match.feature_breakdown,
    })),
    selected_match_contact_id: decision === "resolved" && top ? top.contact.id : null,
    selected_match_confidence: decision === "resolved" && top ? top.score : null,
    decision,
    thresholds: {
      auto_select_min: thresholds.autoSelectMin,
      ambiguous_min: thresholds.ambiguousMin,
    },
  };
}

export async function resolveLeadCandidatesAgainstOwnerContacts(params: {
  ownerUserId: string;
  payload: LeadCandidatesPayloadV2;
}): Promise<{
  payload: LeadCandidatesPayloadV2;
  resolverAudits: ResolverAuditV2[];
}> {
  const contacts = await listOwnerContactDirectory({
    ownerUserId: params.ownerUserId,
    search: null,
    limit: 500,
    includeInactive: false,
    platform: null,
  });

  if (contacts.length === 0) {
    return {
      payload: params.payload,
      resolverAudits: [],
    };
  }

  const thresholds = {
    autoSelectMin: 0.9,
    ambiguousMin: 0.72,
  };

  const resolverAudits: ResolverAuditV2[] = [];
  const nextCandidates = params.payload.lead_candidates.map((candidate) => {
    const queryRaw = [
      candidate.reasons.join(" "),
      ...candidate.evidence_snippets.map((snippet) => snippet.text),
      candidate.resolved_contact?.display_name ?? "",
    ]
      .join(" ")
      .trim();

    const inferredName = candidate.resolved_contact?.display_name ?? candidate.reasons[0] ?? null;
    const input: ResolverCandidateInput = {
      name: inferredName,
      handles: queryRaw.match(/@([A-Za-z0-9._-]{2,40})/g) ?? [],
      emails: queryRaw.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g) ?? [],
      phones: queryRaw.match(/\+?\d[\d()\-\s]{5,20}\d/g) ?? [],
    };

    const matches = contacts
      .map((contact) => scoreContactMatch(contact, input))
      .filter((entry): entry is ResolverMatchResult => Boolean(entry))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const audit = buildResolverAudit(queryRaw || candidate.reasons.join(" "), matches, thresholds);
    resolverAudits.push(audit);

    const qualityFlags = new Set(params.payload.quality_flags);
    if (audit.decision === "ambiguous") {
      qualityFlags.add("resolver_ambiguous");
    }

    const selected = matches[0];
    return {
      ...candidate,
      resolved_contact:
        audit.decision === "resolved" && selected
          ? {
              contact_id: selected.contact.id,
              display_name: selected.contact.display_name,
              confidence: selected.score,
              method: selected.method,
            }
          : null,
      resolution_candidates: matches.map((match) => ({
        contact_id: match.contact.id,
        display_name: match.contact.display_name,
        score: match.score,
        method: match.method,
      })),
      qualityFlags,
    };
  });

  const mergedQualityFlags = new Set(params.payload.quality_flags);
  const leadCandidates = nextCandidates.map((candidate) => {
    for (const flag of candidate.qualityFlags) {
      mergedQualityFlags.add(flag);
    }
    const { qualityFlags: _ignore, ...rest } = candidate;
    return rest;
  });

  return {
    payload: {
      ...params.payload,
      lead_candidates: leadCandidates,
      quality_flags: Array.from(mergedQualityFlags),
    },
    resolverAudits,
  };
}

export function projectLegacySuggestionToLeadCandidates(params: {
  leadSuggestionJson?: string | null;
  leadAnalysisJson?: string | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  llmMs?: number | null;
  llmTimeoutMs?: number | null;
  llmError?: string | null;
  ocrText?: string | null;
  llmConfidence?: number | null;
}): LeadCandidatesPayloadV2 {
  const suggestion = safeParseObject(params.leadSuggestionJson);
  const analysis = safeParseObject(params.leadAnalysisJson);
  const reasons = [
    maybeString(suggestion.reason),
    maybeString(analysis.rationale),
  ].filter((value): value is string => Boolean(value));
  const snippets = [params.ocrText, maybeString(analysis.entries?.[0]), maybeString(analysis.actions?.[0])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((text) => ({
      source: text === params.ocrText ? "ocr" : "llm",
      text: text.slice(0, 220),
    })) as Array<{ source: "ocr" | "llm"; text: string }>;

  const suggestedEventRaw = maybeString(suggestion.suggested_event_type)?.toLowerCase().replace(/[^a-z_]/g, "");
  const intentType =
    suggestedEventRaw === "post_published" ||
    suggestedEventRaw === "link_clicked" ||
    suggestedEventRaw === "inbound_message" ||
    suggestedEventRaw === "quote_requested" ||
    suggestedEventRaw === "meeting_booked" ||
    suggestedEventRaw === "purchase_made"
      ? suggestedEventRaw
      : "other";
  const confidence = typeof params.llmConfidence === "number" ? Math.max(0, Math.min(1, params.llmConfidence)) : 0;
  const qualityFlags = new Set<LeadCandidatesPayloadV2["quality_flags"][number]>(["legacy_projection"]);
  if (confidence > 0 && confidence < 0.35) {
    qualityFlags.add("low_confidence");
  }
  if (params.llmError) {
    qualityFlags.add("llm_timeout");
  }
  if ((params.ocrText ?? "").trim().length < 20) {
    qualityFlags.add("ocr_sparse");
  }

  return {
    schema_version: "v2",
    lead_candidates: [
      {
        candidate_id: randomUUID(),
        intent_type: intentType,
        confidence,
        evidence_snippets: snippets,
        next_action: confidence >= 0.65 ? "review" : "request_evidence",
        reasons: reasons.slice(0, 8),
        resolved_contact: null,
        resolution_candidates: [],
      },
    ],
    model_meta: {
      provider: params.llmProvider ?? null,
      model: params.llmModel ?? null,
      prompt_version: "legacy_projection",
      schema_version: "v2",
      elapsed_ms: params.llmMs ?? null,
      timeout_ms: params.llmTimeoutMs ?? null,
      fallback_used: Boolean(params.llmError),
    },
    quality_flags: Array.from(qualityFlags),
  };
}

function safeParseObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
