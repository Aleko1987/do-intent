import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { createEvent as createEvent_handler } from "../../../../marketing\\create_event.js";
declare const createEvent: WithCallOpts<typeof createEvent_handler>;
export { createEvent };

import { create as create_handler } from "../../../../marketing\\create_lead.js";
declare const create: WithCallOpts<typeof create_handler>;
export { create };

import { getWithEvents as getWithEvents_handler } from "../../../../marketing\\get_lead_events.js";
declare const getWithEvents: WithCallOpts<typeof getWithEvents_handler>;
export { getWithEvents };

import { identify as identify_handler } from "../../../../marketing\\identify.js";
declare const identify: WithCallOpts<typeof identify_handler>;
export { identify };

import { ingestIntentEvent as ingestIntentEvent_handler } from "../../../../marketing\\ingest_intent_event.js";
declare const ingestIntentEvent: WithCallOpts<typeof ingestIntentEvent_handler>;
export { ingestIntentEvent };

import { ingestIntentEventV1 as ingestIntentEventV1_handler } from "../../../../marketing\\ingest_intent_event.js";
declare const ingestIntentEventV1: WithCallOpts<typeof ingestIntentEventV1_handler>;
export { ingestIntentEventV1 };

import { ingestIntentEventOptions as ingestIntentEventOptions_handler } from "../../../../marketing\\ingest_intent_event.js";
declare const ingestIntentEventOptions: WithCallOpts<typeof ingestIntentEventOptions_handler>;
export { ingestIntentEventOptions };

import { ingestIntentEventV1Options as ingestIntentEventV1Options_handler } from "../../../../marketing\\ingest_intent_event.js";
declare const ingestIntentEventV1Options: WithCallOpts<typeof ingestIntentEventV1Options_handler>;
export { ingestIntentEventV1Options };

import { list as list_handler } from "../../../../marketing\\list_leads.js";
declare const list: WithCallOpts<typeof list_handler>;
export { list };

import { update as update_handler } from "../../../../marketing\\update_lead.js";
declare const update: WithCallOpts<typeof update_handler>;
export { update };

import { webhookEvent as webhookEvent_handler } from "../../../../marketing\\webhook_event.js";
declare const webhookEvent: WithCallOpts<typeof webhookEvent_handler>;
export { webhookEvent };


