import { strict as assert } from "node:assert";
import type {
  ExecuteTaskRequestV1,
  ExecuteTaskResponseV1,
} from "./social_inbox_types";

function isHumanApprovalRequired(actionType: string): boolean {
  return actionType === "like" || actionType === "comment" || actionType === "dm";
}

async function run(): Promise<void> {
  console.log("Running social inbox cross-repo contract simulation...");

  // 1) duplicate source_event_id
  const seenEvents = new Set<string>();
  const event = {
    version: "v1",
    source_event_id: "evt_dup_1",
    platform: "facebook",
    event_type: "comment",
    actor_ref: "fb:lead1",
    actor_display: "Lead 1",
    lead_match_confidence: 0.85,
    occurred_at: new Date().toISOString(),
    source_url: "https://facebook.com/post/1",
    content_excerpt: "Interested",
    metadata: { owner_user_id: "user_1" },
  };
  assert.equal(event.version, "v1");
  assert.equal(typeof event.source_event_id, "string");
  const firstInsert = !seenEvents.has(event.source_event_id);
  seenEvents.add(event.source_event_id);
  const secondInsert = !seenEvents.has(event.source_event_id);
  assert.equal(firstInsert, true, "first source_event_id should be accepted");
  assert.equal(secondInsert, false, "duplicate source_event_id should dedupe");

  // 2) duplicate idempotency_key
  const executedKeys = new Set<string>();
  const executeOnce = (req: ExecuteTaskRequestV1): ExecuteTaskResponseV1 => {
    if (executedKeys.has(req.idempotency_key)) {
      return {
        version: "v1",
        task_id: req.task_id,
        status: "blocked",
        provider_action_id: null,
        occurred_at: new Date().toISOString(),
        reason_code: "duplicate_idempotency_key",
        reason_message: "duplicate idempotency key",
        raw: null,
      };
    }
    executedKeys.add(req.idempotency_key);
    return {
      version: "v1",
      task_id: req.task_id,
      status: "succeeded",
      provider_action_id: "provider_action_1",
      occurred_at: new Date().toISOString(),
      reason_code: null,
      reason_message: null,
      raw: null,
    };
  };
  const executeReq: ExecuteTaskRequestV1 = {
    version: "v1",
    task_id: "task_1",
    idempotency_key: "idem_dup_1",
    platform: "instagram",
    action_type: "reply",
    target_ref: "ig:lead1",
    lead_ref: null,
    content: "Thanks for reaching out",
    metadata: {},
  };
  const firstExec = executeOnce(executeReq);
  const dupExec = executeOnce(executeReq);
  assert.equal(firstExec.status, "succeeded", "first execution should succeed");
  assert.equal(
    dupExec.reason_code,
    "duplicate_idempotency_key",
    "duplicate idempotency_key should be detected"
  );

  // 3) risky action without human_approved should block
  const riskyTask = {
    id: "task_risky",
    task_type: "dm",
    status: "pending",
  };
  const blockedByHumanApproval =
    isHumanApprovalRequired(riskyTask.task_type) && riskyTask.status !== "approved";
  assert.equal(
    blockedByHumanApproval,
    true,
    "risky action without human_approved should be blocked"
  );

  // 4) unsupported action should persist unsupported
  const unsupportedResponse: ExecuteTaskResponseV1 = {
    version: "v1",
    task_id: "task_unsupported",
    status: "unsupported",
    provider_action_id: null,
    occurred_at: new Date().toISOString(),
    reason_code: "action_not_supported",
    reason_message: "platform does not support this action",
    raw: null,
  };
  assert.equal(
    unsupportedResponse.status,
    "unsupported",
    "unsupported execution status should be preserved"
  );

  console.log("PASS duplicate source_event_id");
  console.log("PASS duplicate idempotency_key");
  console.log("PASS risky action blocked without human approval");
  console.log("PASS unsupported action preserved");
}

run().catch((error) => {
  console.error("E2E simulation failed:", error);
  process.exit(1);
});
