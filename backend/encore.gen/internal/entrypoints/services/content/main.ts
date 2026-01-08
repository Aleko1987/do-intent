import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { create as createImpl0 } from "../../../../../content\\create_item";
import { deleteItem as deleteItemImpl1 } from "../../../../../content\\delete_item";
import { list as listImpl2 } from "../../../../../content\\list_items";
import { logPost as logPostImpl3 } from "../../../../../content\\log_post";
import { update as updateImpl4 } from "../../../../../content\\update_item";
import * as content_service from "../../../../../content\\encore.service";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "content",
            name:              "create",
            handler:           createImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "deleteItem",
            handler:           deleteItemImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "list",
            handler:           listImpl2,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "logPost",
            handler:           logPostImpl3,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "update",
            handler:           updateImpl4,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
