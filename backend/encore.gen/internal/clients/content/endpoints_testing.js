import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";

import * as content_service from "../../../../content\\encore.service";

export async function create(params, opts) {
    const handler = (await import("../../../../content\\create_item")).create;
    registerTestHandler({
        apiRoute: { service: "content", name: "create", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: content_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("content", "create", params, opts);
}

export async function deleteItem(params, opts) {
    const handler = (await import("../../../../content\\delete_item")).deleteItem;
    registerTestHandler({
        apiRoute: { service: "content", name: "deleteItem", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: content_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("content", "deleteItem", params, opts);
}

export async function list(params, opts) {
    const handler = (await import("../../../../content\\list_items")).list;
    registerTestHandler({
        apiRoute: { service: "content", name: "list", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: content_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("content", "list", params, opts);
}

export async function logPost(params, opts) {
    const handler = (await import("../../../../content\\log_post")).logPost;
    registerTestHandler({
        apiRoute: { service: "content", name: "logPost", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: content_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("content", "logPost", params, opts);
}

export async function update(params, opts) {
    const handler = (await import("../../../../content\\update_item")).update;
    registerTestHandler({
        apiRoute: { service: "content", name: "update", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: content_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("content", "update", params, opts);
}

