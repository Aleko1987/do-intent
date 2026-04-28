import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "../db/db";
import { applyCorrelationId } from "../internal/correlation";
import type { JsonObject } from "../internal/json_types";
import { autoScoreEvent } from "../intent_scorer/auto_score";
import { checkAndPushToSales } from "./auto_push";
import { updateLeadScoring } from "./scoring";
import {
  isScoreEligibleExecution,
  isHumanApprovalRequired,
  isTaskExecutable,
  mapEventTypeToTaskType,
  parseJsonObject,
  parseNormalizedSocialEvent,
  resolveSocialExecutionScoringRule,
  resolveExecutionUrl,
  resolveDefaultCap,
} from "./social_inbox_helpers";
import type {
  ExecuteTaskRequestV1,
  ExecuteTaskResponseV1,
  InboxTaskRow,
  SocialActionType,
  SocialPlatform,
  SocialWatchlistRow,
} from "./social_inbox_types";

type ActionBudgetRow = {
  used_count: number;
  cap_count: number;
};

interface IngestResponse {
  accepted: boolean;
  deduped: boolean;
  task_id: string | null;
}

interface ListInboxTasksRequest {
  status?: string;
  platform?: string;
  limit?: number;
}

interface ListInboxTasksResponse {
  items: InboxTaskRow[];
}

interface ApproveInboxTaskRequest {
  id: string;
}

interface ApproveInboxTaskResponse {
  task: InboxTaskRow;
}

interface RejectInboxTaskRequest {
  id: string;
  reason?: string;
}

interface RejectInboxTaskResponse {
  task: InboxTaskRow;
}

interface ExecuteInboxTaskRequest {
  id: string;
}

interface ExecuteInboxTaskResponse {
  task: InboxTaskRow;
  execution: ExecuteTaskResponseV1;
  score_effect?: ScoreEffect;
}

interface ScoreEffect {
  status: "applied" | "skipped";
  reason:
    | "execution_succeeded"
    | "execution_not_succeeded"
    | "feature_disabled"
    | "no_lead_linked"
    | "duplicate_execution"
    | "missing_scoring_rule"
    | "rule_not_score_eligible"
    | "scoring_pipeline_error";
  ledger_id?: string;
  delta_points?: number;
}

interface ListWatchlistsResponse {
  items: SocialWatchlistRow[];
}

interface CreateWatchlistRequest {
  lead_id?: string;
  platform: string;
  external_profile_ref: string;
  priority?: number;
  enabled?: boolean;
  metadata?: string;
}

interface CreateWatchlistResponse {
  watchlist: SocialWatchlistRow;
}

interface UpdateWatchlistRequest {
  id: string;
  priority?: number;
  enabled?: boolean;
  metadata?: string;
}

interface UpdateWatchlistResponse {
  watchlist: SocialWatchlistRow;
}

interface DeleteWatchlistRequest {
  id: string;
}

interface ExecutionAttemptRow {
  id: string;
}

interface SocialActivityEventRow {
  id: string;
  lead_id: string | null;
}

interface LeadScoreLedgerRow {
  id: string;
}

interface InboxTaskListQueryRow extends InboxTaskRow {
  social_activity_event_id: string | null;
  lead_score_ledger_id: string | null;
  lead_score_ledger_delta_points: number | null;
  lead_score_ledger_reason_code: string | null;
  latest_execution_attempt_id: string | null;
}

function parseMetadataString(metadata: string | undefined): JsonObject {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parseJsonObject(parsed) as JsonObject;
  } catch {
    return {};
  }
}

function resolveExecutionIdempotencyKey(task: InboxTaskRow): string {
  const payload = parseJsonObject(task.payload_json) as Record<string, unknown>;
  const externalKey = payload.idempotency_key;
  if (typeof externalKey === "string" && externalKey.trim()) {
    return externalKey.trim();
  }
  return `execute:${task.id}`;
}

function isSocialExecutionScoringEnabled(): boolean {
  const raw = process.env.SOCIAL_EXECUTION_SCORING_ENABLED;
  if (typeof raw !== "string") {
    return true;
  }
  return raw.trim().toLowerCase() !== "false";
}

async function readLeadIntentScore(leadId: string): Promise<number | null> {
  const row = await db.rawQueryRow<{ intent_score: number | null }>(
    `SELECT intent_score FROM marketing_leads WHERE id = $1`,
    leadId
  );
  return row?.intent_score ?? null;
}

function requireUserId(): string {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }
  return authData.userID;
}

function normalizePlatform(input: string): SocialPlatform {
  const value = input.trim().toLowerCase();
  if (value === "facebook" || value === "instagram" || value === "whatsapp") {
    return value;
  }
  throw APIError.invalidArgument("unsupported platform");
}

function normalizeActionType(input: string): SocialActionType {
  const value = input.trim().toLowerCase();
  if (value === "like" || value === "comment" || value === "reply" || value === "dm") {
    return value;
  }
  throw APIError.invalidArgument("unsupported action type");
}

function parseLimit(limit?: number): number {
  if (limit === undefined) return 100;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw APIError.invalidArgument("limit must be a positive integer");
  }
  return Math.min(limit, 200);
}

function checkServiceToken(req: IncomingMessage): boolean {
  const expected = process.env.DO_SOCIALS_INGEST_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.authorization;
  if (typeof auth !== "string") return false;
  return auth.trim() === `Bearer ${expected}`;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

async function checkBudgetAndCooldown(params: {
  ownerUserId: string;
  platform: SocialPlatform;
  actionType: SocialActionType;
  targetRef: string;
}): Promise<{ allowed: boolean; reason: string | null; used: number; cap: number }> {
  const budget = await db.rawQueryRow<ActionBudgetRow>(
    `SELECT used_count, cap_count
     FROM action_budgets
     WHERE owner_user_id = $1
       AND platform = $2
       AND action_type = $3
       AND budget_date = CURRENT_DATE`,
    params.ownerUserId,
    params.platform,
    params.actionType
  );

  const used = budget?.used_count ?? 0;
  const cap = budget?.cap_count ?? resolveDefaultCap(params.platform, params.actionType);
  if (cap <= 0) {
    return { allowed: false, reason: "action_type_not_supported_for_platform", used, cap };
  }
  if (used >= cap) {
    return { allowed: false, reason: "daily_budget_exceeded", used, cap };
  }

  const cooldown = await db.rawQueryRow<{ exists: boolean }>(
    `SELECT TRUE AS exists
     FROM execution_attempts ea
     INNER JOIN inbox_tasks it ON it.id = ea.task_id
     WHERE it.owner_user_id = $1
       AND it.platform = $2
       AND it.task_type = $3
       AND it.target_ref = $4
       AND ea.status = 'succeeded'
       AND ea.attempted_at > now() - interval '6 hours'
     LIMIT 1`,
    params.ownerUserId,
    params.platform,
    params.actionType,
    params.targetRef
  );
  if (cooldown?.exists) {
    return { allowed: false, reason: "cooldown_active", used, cap };
  }
  return { allowed: true, reason: null, used, cap };
}

export const ingestSocialEvent = api.raw(
  { expose: true, method: "POST", path: "/social-events/ingest" },
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const corr = applyCorrelationId(req, res);
    try {
      if (!checkServiceToken(req)) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ code: "forbidden", message: "forbidden", corr }));
        return;
      }

      const body = await readJsonBody(req);
      const event = parseNormalizedSocialEvent(body);
      const ownerUserId = event.metadata.owner_user_id;
      if (typeof ownerUserId !== "string" || !ownerUserId.trim()) {
        throw APIError.invalidArgument("metadata.owner_user_id is required");
      }

      const taskType = mapEventTypeToTaskType(event.event_type);
      const payloadJson = parseJsonObject({
        lead_match_confidence: event.lead_match_confidence,
        content_excerpt: event.content_excerpt,
        source_url: event.source_url,
        ...event.metadata,
      }) as JsonObject;

      const inserted = await db.rawQueryRow<{ id: string }>(
        `INSERT INTO inbox_tasks (
          owner_user_id, source_event_id, platform, event_type, task_type, status, priority,
          lead_id, actor_ref, actor_display, target_ref, source_url, content_excerpt,
          suggested_reply, payload_json, due_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'pending', $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14::jsonb, now(), now(), now()
        )
        ON CONFLICT (owner_user_id, source_event_id) DO NOTHING
        RETURNING id`,
        ownerUserId.trim(),
        event.source_event_id,
        event.platform,
        event.event_type,
        taskType,
        Number(event.metadata.priority ?? 50),
        typeof event.metadata.lead_id === "string" ? event.metadata.lead_id : null,
        event.actor_ref,
        event.actor_display,
        event.actor_ref,
        event.source_url,
        event.content_excerpt,
        event.content_excerpt,
        JSON.stringify(payloadJson)
      );

      const response: IngestResponse = {
        accepted: true,
        deduped: !inserted,
        task_id: inserted?.id ?? null,
      };
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid request";
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: "invalid_argument", message, corr }));
    }
  }
);

export const listInboxTasks = api<ListInboxTasksRequest, ListInboxTasksResponse>(
  { expose: true, method: "GET", path: "/inbox/tasks", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const params: unknown[] = [ownerUserId];
    const where: string[] = ["it.owner_user_id = $1"];

    if (req.status) {
      params.push(req.status.trim().toLowerCase());
      where.push(`it.status = $${params.length}`);
    }
    if (req.platform) {
      const platform = normalizePlatform(req.platform);
      params.push(platform);
      where.push(`it.platform = $${params.length}`);
    }
    params.push(parseLimit(req.limit));

    let rows: InboxTaskListQueryRow[];
    try {
      rows = await db.rawQueryAll<InboxTaskListQueryRow>(
        `SELECT
           it.*,
           sa.id AS social_activity_event_id,
           lsl.id AS lead_score_ledger_id,
           lsl.delta_points AS lead_score_ledger_delta_points,
           lsl.reason_code AS lead_score_ledger_reason_code,
           lea.id AS latest_execution_attempt_id
         FROM inbox_tasks it
         LEFT JOIN LATERAL (
           SELECT ea.id
           FROM execution_attempts ea
           WHERE ea.task_id = it.id
           ORDER BY ea.attempted_at DESC
           LIMIT 1
         ) lea ON TRUE
         LEFT JOIN LATERAL (
           SELECT sae.id
           FROM social_activity_events sae
           WHERE sae.owner_user_id = it.owner_user_id
             AND sae.inbox_task_id = it.id
           ORDER BY sae.created_at DESC
           LIMIT 1
         ) sa ON TRUE
         LEFT JOIN LATERAL (
           SELECT ledger.id, ledger.delta_points, ledger.reason_code
           FROM lead_score_ledger ledger
           WHERE ledger.owner_user_id = it.owner_user_id
             AND ledger.inbox_task_id = it.id
           ORDER BY ledger.applied_at DESC
           LIMIT 1
         ) lsl ON TRUE
         WHERE ${where.join(" AND ")}
         ORDER BY it.priority DESC, it.created_at DESC
         LIMIT $${params.length}`,
        ...params
      );
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code !== "42P01") {
        throw error;
      }
      rows = await db.rawQueryAll<InboxTaskListQueryRow>(
        `SELECT
           it.*,
           NULL::uuid AS social_activity_event_id,
           NULL::uuid AS lead_score_ledger_id,
           NULL::integer AS lead_score_ledger_delta_points,
           NULL::text AS lead_score_ledger_reason_code,
           lea.id AS latest_execution_attempt_id
         FROM inbox_tasks it
         LEFT JOIN LATERAL (
           SELECT ea.id
           FROM execution_attempts ea
           WHERE ea.task_id = it.id
           ORDER BY ea.attempted_at DESC
           LIMIT 1
         ) lea ON TRUE
         WHERE ${where.join(" AND ")}
         ORDER BY it.priority DESC, it.created_at DESC
         LIMIT $${params.length}`,
        ...params
      );
    }
    const items: InboxTaskRow[] = rows.map((row) => {
      let scoreImpactStatus: InboxTaskRow["score_impact_status"] = "none";
      let scoreImpactReason: string | null = null;
      if (row.lead_score_ledger_id) {
        scoreImpactStatus = "applied";
        scoreImpactReason = row.lead_score_ledger_reason_code ?? "execution_succeeded";
      } else if (row.status === "pending" || row.status === "approved" || row.status === "executing") {
        scoreImpactStatus = "pending_execution";
      } else if (row.status === "executed") {
        scoreImpactStatus = "skipped";
        scoreImpactReason = row.lead_id ? "duplicate_execution" : "no_lead_linked";
      }
      return {
        ...row,
        score_impact_status: scoreImpactStatus,
        score_delta_points: row.lead_score_ledger_delta_points,
        score_impact_reason: scoreImpactReason,
        latest_execution_attempt_id: row.latest_execution_attempt_id,
      };
    });
    return { items };
  }
);

export const approveInboxTask = api<ApproveInboxTaskRequest, ApproveInboxTaskResponse>(
  { expose: true, method: "POST", path: "/inbox/tasks/:id/approve", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const existing = await db.rawQueryRow<InboxTaskRow>(
      `SELECT * FROM inbox_tasks WHERE id = $1 AND owner_user_id = $2`,
      req.id,
      ownerUserId
    );
    if (!existing) {
      throw APIError.notFound("task not found");
    }
    if (existing.status !== "pending") {
      throw APIError.failedPrecondition("task is not pending");
    }

    const budgetCheck = await checkBudgetAndCooldown({
      ownerUserId,
      platform: existing.platform,
      actionType: existing.task_type,
      targetRef: existing.target_ref,
    });
    if (!budgetCheck.allowed) {
      const blocked = await db.rawQueryRow<InboxTaskRow>(
        `UPDATE inbox_tasks
         SET status = 'blocked', updated_at = now()
         WHERE id = $1 AND owner_user_id = $2
         RETURNING *`,
        req.id,
        ownerUserId
      );
      if (!blocked) {
        throw APIError.internal("failed to block task");
      }
      return { task: blocked };
    }

    const task = await db.rawQueryRow<InboxTaskRow>(
      `UPDATE inbox_tasks
       SET status = 'approved', approved_by_user_id = $3, approved_at = now(), updated_at = now()
       WHERE id = $1 AND owner_user_id = $2
       RETURNING *`,
      req.id,
      ownerUserId,
      ownerUserId
    );
    if (!task) {
      throw APIError.internal("failed to approve task");
    }
    return { task };
  }
);

export const rejectInboxTask = api<RejectInboxTaskRequest, RejectInboxTaskResponse>(
  { expose: true, method: "POST", path: "/inbox/tasks/:id/reject", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const task = await db.rawQueryRow<InboxTaskRow>(
      `UPDATE inbox_tasks
       SET status = 'rejected',
           rejected_by_user_id = $3,
           rejected_at = now(),
           rejection_reason = $4,
           updated_at = now()
       WHERE id = $1 AND owner_user_id = $2
       RETURNING *`,
      req.id,
      ownerUserId,
      ownerUserId,
      req.reason?.slice(0, 500) ?? null
    );
    if (!task) {
      throw APIError.notFound("task not found");
    }
    return { task };
  }
);

export const executeInboxTask = api<ExecuteInboxTaskRequest, ExecuteInboxTaskResponse>(
  { expose: true, method: "POST", path: "/inbox/tasks/:id/execute", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const existing = await db.rawQueryRow<InboxTaskRow>(
      `SELECT * FROM inbox_tasks WHERE id = $1 AND owner_user_id = $2`,
      req.id,
      ownerUserId
    );
    if (!existing) {
      throw APIError.notFound("task not found");
    }
    if (isHumanApprovalRequired(existing.task_type) && existing.status !== "approved") {
      const blockedPayload: ExecuteTaskResponseV1 = {
        version: "v1",
        task_id: existing.id,
        status: "blocked",
        provider_action_id: null,
        occurred_at: new Date().toISOString(),
        reason_code: "human_approval_required",
        reason_message: "Human approval is required before execution",
        raw: null,
      };
      await db.rawExec(
        `INSERT INTO execution_attempts (owner_user_id, task_id, status, request_payload, response_payload, error, attempted_at)
         VALUES ($1, $2, 'blocked', $3::jsonb, $4::jsonb, $5, now())`,
        ownerUserId,
        existing.id,
        JSON.stringify({}),
        JSON.stringify(blockedPayload),
        "human_approval_required"
      );
      const blockedTask = await db.rawQueryRow<InboxTaskRow>(
        `UPDATE inbox_tasks
         SET status = 'blocked', updated_at = now()
         WHERE id = $1 AND owner_user_id = $2
         RETURNING *`,
        existing.id,
        ownerUserId
      );
      if (!blockedTask) {
        throw APIError.internal("failed to block task");
      }
      return { task: blockedTask, execution: blockedPayload };
    }
    if (!isTaskExecutable(existing)) {
      throw APIError.failedPrecondition("task cannot be executed in current status");
    }

    const budgetCheck = await checkBudgetAndCooldown({
      ownerUserId,
      platform: existing.platform,
      actionType: existing.task_type,
      targetRef: existing.target_ref,
    });
    if (!budgetCheck.allowed) {
      const blockedPayload: ExecuteTaskResponseV1 = {
        version: "v1",
        task_id: existing.id,
        status: "blocked",
        provider_action_id: null,
        occurred_at: new Date().toISOString(),
        reason_code: budgetCheck.reason,
        reason_message: "Risk control blocked execution",
        raw: null,
      };
      await db.rawExec(
        `INSERT INTO execution_attempts (owner_user_id, task_id, status, request_payload, response_payload, error, attempted_at)
         VALUES ($1, $2, 'blocked', $3::jsonb, $4::jsonb, $5, now())`,
        ownerUserId,
        existing.id,
        JSON.stringify({}),
        JSON.stringify(blockedPayload),
        budgetCheck.reason
      );
      const blockedTask = await db.rawQueryRow<InboxTaskRow>(
        `UPDATE inbox_tasks
         SET status = 'blocked', updated_at = now()
         WHERE id = $1 AND owner_user_id = $2
         RETURNING *`,
        existing.id,
        ownerUserId
      );
      if (!blockedTask) {
        throw APIError.internal("failed to block task");
      }
      return { task: blockedTask, execution: blockedPayload };
    }

    const executionUrl = resolveExecutionUrl();
    const executionToken = process.env.DO_SOCIALS_EXECUTE_TOKEN?.trim();
    if (!executionToken) {
      throw APIError.internal("DO_SOCIALS_EXECUTE_TOKEN not configured");
    }

    const executing = await db.rawQueryRow<InboxTaskRow>(
      `UPDATE inbox_tasks
       SET status = 'executing', updated_at = now()
       WHERE id = $1 AND owner_user_id = $2
       RETURNING *`,
      existing.id,
      ownerUserId
    );
    if (!executing) {
      throw APIError.internal("failed to mark task executing");
    }

    const requestPayload: ExecuteTaskRequestV1 = {
      version: "v1",
      task_id: executing.id,
      idempotency_key: resolveExecutionIdempotencyKey(executing),
      platform: executing.platform,
      action_type: executing.task_type,
      target_ref: executing.target_ref,
      lead_ref: executing.lead_id,
      content: executing.suggested_reply,
      metadata: parseJsonObject(executing.payload_json) as JsonObject,
    };

    let execution: ExecuteTaskResponseV1;
    let errorMessage: string | null = null;
    try {
      const response = await fetch(executionUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${executionToken}`,
        },
        body: JSON.stringify(requestPayload),
      });
      const responseJson = (await response.json()) as unknown;
      if (!response.ok) {
        errorMessage = typeof (responseJson as any)?.reason_message === "string"
          ? (responseJson as any).reason_message
          : `execution failed with status ${response.status}`;
      }
      const parsed = responseJson as Partial<ExecuteTaskResponseV1>;
      execution = {
        version: "v1",
        task_id: typeof parsed.task_id === "string" ? parsed.task_id : executing.id,
        status:
          parsed.status === "succeeded" ||
          parsed.status === "failed" ||
          parsed.status === "blocked" ||
          parsed.status === "unsupported"
            ? parsed.status
            : "failed",
        provider_action_id: typeof parsed.provider_action_id === "string" ? parsed.provider_action_id : null,
        occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : new Date().toISOString(),
        reason_code: typeof parsed.reason_code === "string" ? parsed.reason_code : null,
        reason_message:
          typeof parsed.reason_message === "string" ? parsed.reason_message : errorMessage,
        raw: parsed.raw ? (parseJsonObject(parsed.raw) as JsonObject) : null,
      };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "execution call failed";
      execution = {
        version: "v1",
        task_id: executing.id,
        status: "failed",
        provider_action_id: null,
        occurred_at: new Date().toISOString(),
        reason_code: "network_error",
        reason_message: errorMessage,
        raw: null,
      };
    }

    const executionAttempt = await db.rawQueryRow<ExecutionAttemptRow>(
      `INSERT INTO execution_attempts (owner_user_id, task_id, status, request_payload, response_payload, error, attempted_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, now())
       RETURNING id`,
      ownerUserId,
      executing.id,
      execution.status,
      JSON.stringify(requestPayload),
      JSON.stringify(execution),
      errorMessage
    );
    if (!executionAttempt) {
      throw APIError.internal("failed to record execution attempt");
    }

    if (execution.status === "succeeded") {
      await db.rawExec(
        `INSERT INTO action_budgets (owner_user_id, platform, action_type, budget_date, used_count, cap_count, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_DATE, 1, $4, now(), now())
         ON CONFLICT (owner_user_id, platform, action_type, budget_date)
         DO UPDATE SET used_count = action_budgets.used_count + 1, updated_at = now()`,
        ownerUserId,
        executing.platform,
        executing.task_type,
        resolveDefaultCap(executing.platform, executing.task_type)
      );
    }

    const nextStatus: InboxTaskRow["status"] =
      execution.status === "succeeded"
        ? "executed"
        : execution.status === "blocked"
          ? "blocked"
          : execution.status === "unsupported"
            ? "unsupported"
            : "failed";

    const scoreRule = resolveSocialExecutionScoringRule({
      platform: executing.platform,
      actionType: executing.task_type,
      taskStatus: nextStatus,
      executionStatus: execution.status,
    });

    const task = await db.rawQueryRow<InboxTaskRow>(
      `UPDATE inbox_tasks
       SET status = $3,
           executed_by_user_id = $4,
           executed_at = CASE WHEN $3 = 'executed' THEN now() ELSE executed_at END,
           updated_at = now()
       WHERE id = $1 AND owner_user_id = $2
       RETURNING *`,
      existing.id,
      ownerUserId,
      nextStatus,
      ownerUserId
    );
    if (!task) {
      throw APIError.internal("failed to update task after execution");
    }
    let scoreEffect: ScoreEffect | undefined;
    if (!isScoreEligibleExecution({ taskStatus: nextStatus, executionStatus: execution.status })) {
      scoreEffect = { status: "skipped", reason: "execution_not_succeeded" };
      return { task, execution, score_effect: scoreEffect };
    }
    if (!isSocialExecutionScoringEnabled()) {
      scoreEffect = { status: "skipped", reason: "feature_disabled" };
      return { task, execution, score_effect: scoreEffect };
    }
    if (!scoreRule) {
      scoreEffect = { status: "skipped", reason: "missing_scoring_rule" };
      return { task, execution, score_effect: scoreEffect };
    }

    try {
      const activityMetadata = parseJsonObject({
        ...(parseJsonObject(executing.payload_json) as Record<string, string | number | boolean | null>),
        source_task_status: nextStatus,
        execution_status: execution.status,
        execution_reason_code: execution.reason_code,
        execution_reason_message: execution.reason_message,
        provider_action_id: execution.provider_action_id,
        approved_by_user_id: executing.approved_by_user_id,
        approved_at: executing.approved_at,
        executed_by_user_id: ownerUserId,
      }) as JsonObject;

      const socialActivityEvent = await db.rawQueryRow<SocialActivityEventRow>(
        `INSERT INTO social_activity_events (
         owner_user_id,
         lead_id,
         inbox_task_id,
         execution_attempt_id,
         execution_idempotency_key,
         source_event_id,
         platform,
         action_type,
         actor_ref,
         actor_display,
         target_ref,
         occurred_at,
         metadata,
         created_by_user_id,
         created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::jsonb, $14, now()
       )
       ON CONFLICT (owner_user_id, inbox_task_id, execution_idempotency_key)
       DO UPDATE SET occurred_at = EXCLUDED.occurred_at
         RETURNING id, lead_id`,
        ownerUserId,
        executing.lead_id,
        executing.id,
        executionAttempt.id,
        requestPayload.idempotency_key,
        executing.source_event_id,
        executing.platform,
        executing.task_type,
        executing.actor_ref,
        executing.actor_display,
        executing.target_ref,
        execution.occurred_at,
        JSON.stringify(activityMetadata),
        ownerUserId
      );
      if (!socialActivityEvent) {
        throw APIError.internal("failed to persist social activity event");
      }

      if (!socialActivityEvent.lead_id) {
        scoreEffect = { status: "skipped", reason: "no_lead_linked" };
        return { task, execution, score_effect: scoreEffect };
      }

      const leadId = socialActivityEvent.lead_id;
      const previousScore = await readLeadIntentScore(leadId);
      const reasonCode = "execution_succeeded";
      const reasonMessage = execution.reason_message ?? "Scoring applied after successful execution";
      const ledgerMetadata = parseJsonObject({
        source_event_id: executing.source_event_id,
        provider_action_id: execution.provider_action_id,
        execution_reason_code: execution.reason_code,
        execution_status: execution.status,
        platform: executing.platform,
        action_type: executing.task_type,
        actor_ref: executing.actor_ref,
        actor_display: executing.actor_display,
        target_ref: executing.target_ref,
        source_url: executing.source_url,
      }) as JsonObject;

      const leadScoreLedger = await db.rawQueryRow<LeadScoreLedgerRow>(
        `INSERT INTO lead_score_ledger (
         owner_user_id,
         lead_id,
         source_kind,
         source_id,
         inbox_task_id,
         execution_attempt_id,
         score_rule_key,
         delta_points,
         previous_score,
         new_score,
         applied_at,
         applied_by_user_id,
         reason_code,
         reason_message,
         metadata
       ) VALUES (
         $1, $2, 'social_execution', $3, $4, $5, $6, $7, $8, NULL, now(), $9, $10, $11, $12::jsonb
       )
         ON CONFLICT (owner_user_id, source_kind, source_id) DO NOTHING
         RETURNING id`,
        ownerUserId,
        leadId,
        socialActivityEvent.id,
        executing.id,
        executionAttempt.id,
        scoreRule.score_rule_key,
        scoreRule.delta_points,
        previousScore,
        ownerUserId,
        reasonCode,
        reasonMessage,
        JSON.stringify(ledgerMetadata)
      );

      if (!leadScoreLedger) {
        scoreEffect = { status: "skipped", reason: "duplicate_execution" };
        return { task, execution, score_effect: scoreEffect };
      }

      const dedupeKey = `social_exec:${ownerUserId}:${executing.id}:${requestPayload.idempotency_key}`;
      let event = await db.rawQueryRow<{ id: string }>(
        `INSERT INTO intent_events (
         lead_id,
         anonymous_id,
         event_type,
         event_source,
         event_value,
         dedupe_key,
         metadata,
         occurred_at,
         created_at
       ) VALUES (
         $1, NULL, $2, 'social_inbox_execution', $3, $4, $5::jsonb, $6::timestamptz, now()
       )
         ON CONFLICT (event_source, dedupe_key) DO NOTHING
         RETURNING id`,
        leadId,
        scoreRule.event_type,
        scoreRule.delta_points,
        dedupeKey,
        JSON.stringify(
          parseJsonObject({
            social_activity_event_id: socialActivityEvent.id,
            inbox_task_id: executing.id,
            execution_attempt_id: executionAttempt.id,
            platform: executing.platform,
            action_type: executing.task_type,
            actor_ref: executing.actor_ref,
            actor_display: executing.actor_display,
            target_ref: executing.target_ref,
            source_url: executing.source_url,
            source_event_id: executing.source_event_id,
            provider_action_id: execution.provider_action_id,
          }) as JsonObject
        ),
        execution.occurred_at
      );
      if (!event) {
        event = await db.rawQueryRow<{ id: string }>(
          `SELECT id FROM intent_events WHERE event_source = 'social_inbox_execution' AND dedupe_key = $1`,
          dedupeKey
        );
      }
      if (!event) {
        throw APIError.internal("failed to persist social execution intent event");
      }

      await autoScoreEvent(event.id);
      await updateLeadScoring(leadId);
      await checkAndPushToSales(leadId);
      const newScore = await readLeadIntentScore(leadId);
      await db.rawExec(
        `UPDATE lead_score_ledger
         SET new_score = $3
         WHERE id = $1 AND owner_user_id = $2`,
        leadScoreLedger.id,
        ownerUserId,
        newScore
      );

      scoreEffect = {
        status: "applied",
        reason: "execution_succeeded",
        ledger_id: leadScoreLedger.id,
        delta_points: scoreRule.delta_points,
      };
      return { task, execution, score_effect: scoreEffect };
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "42P01") {
        scoreEffect = { status: "skipped", reason: "feature_disabled" };
        return { task, execution, score_effect: scoreEffect };
      }
      console.error("[social-inbox] scoring pipeline failed after execution", {
        task_id: executing.id,
        owner_user_id: ownerUserId,
        error,
      });
      scoreEffect = { status: "skipped", reason: "scoring_pipeline_error" };
      return { task, execution, score_effect: scoreEffect };
    }
  }
);

export const listWatchlists = api<void, ListWatchlistsResponse>(
  { expose: true, method: "GET", path: "/watchlists", auth: true },
  async () => {
    const ownerUserId = requireUserId();
    const items = await db.rawQueryAll<SocialWatchlistRow>(
      `SELECT * FROM social_watchlists
       WHERE owner_user_id = $1
       ORDER BY enabled DESC, priority DESC, created_at DESC`,
      ownerUserId
    );
    return { items };
  }
);

export const createWatchlist = api<CreateWatchlistRequest, CreateWatchlistResponse>(
  { expose: true, method: "POST", path: "/watchlists", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const platform = normalizePlatform(req.platform);
    const externalProfileRef = req.external_profile_ref.trim();
    if (!externalProfileRef) {
      throw APIError.invalidArgument("external_profile_ref is required");
    }

    const watchlist = await db.rawQueryRow<SocialWatchlistRow>(
      `INSERT INTO social_watchlists (
        owner_user_id, lead_id, platform, external_profile_ref, priority, enabled, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
      ON CONFLICT (owner_user_id, platform, external_profile_ref)
      DO UPDATE SET
        lead_id = EXCLUDED.lead_id,
        priority = EXCLUDED.priority,
        enabled = EXCLUDED.enabled,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING *`,
      ownerUserId,
      req.lead_id ?? null,
      platform,
      externalProfileRef,
      req.priority ?? 50,
      req.enabled ?? true,
      JSON.stringify(parseMetadataString(req.metadata))
    );
    if (!watchlist) {
      throw APIError.internal("failed to create watchlist");
    }
    return { watchlist };
  }
);

export const updateWatchlist = api<UpdateWatchlistRequest, UpdateWatchlistResponse>(
  { expose: true, method: "POST", path: "/watchlists/:id", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const watchlist = await db.rawQueryRow<SocialWatchlistRow>(
      `UPDATE social_watchlists
       SET priority = COALESCE($3, priority),
           enabled = COALESCE($4, enabled),
           metadata = CASE WHEN $5::text = '' THEN metadata ELSE $5::jsonb END,
           updated_at = now()
       WHERE id = $1 AND owner_user_id = $2
       RETURNING *`,
      req.id,
      ownerUserId,
      req.priority ?? null,
      typeof req.enabled === "boolean" ? req.enabled : null,
      req.metadata ? JSON.stringify(parseMetadataString(req.metadata)) : ""
    );
    if (!watchlist) {
      throw APIError.notFound("watchlist not found");
    }
    return { watchlist };
  }
);

export const deleteWatchlist = api<DeleteWatchlistRequest, void>(
  { expose: true, method: "DELETE", path: "/watchlists/:id", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    await db.rawExec(`DELETE FROM social_watchlists WHERE id = $1 AND owner_user_id = $2`, req.id, ownerUserId);
  }
);
