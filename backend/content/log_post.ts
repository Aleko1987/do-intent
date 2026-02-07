import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { ContentPostLog, ContentItem } from "./types";

interface LogPostRequest {
  id: string;
  channel: string;
  posted_at?: string;
  status: string;
  platform_response?: JsonObject;
}

// Logs a content post to a channel.
export const logPost = api<LogPostRequest, ContentPostLog>(
  { expose: true, method: "POST", path: "/content/items/:id/logs", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    
    const item = await db.queryRow<ContentItem>`
      SELECT * FROM content_items WHERE id = ${req.id} AND created_by_user_id = ${authData.userID}
    `;
    
    if (!item) {
      throw new Error("Content item not found");
    }
    const log = await db.queryRow<ContentPostLog>`
      INSERT INTO content_post_logs (
        content_item_id,
        channel,
        posted_at,
        status,
        platform_response,
        created_at
      ) VALUES (
        ${req.id},
        ${req.channel},
        ${req.posted_at || new Date().toISOString()},
        ${req.status},
        ${JSON.stringify(req.platform_response || {})},
        now()
      )
      RETURNING *
    `;

    if (!log) {
      throw new Error("Failed to create post log");
    }

    // Update content item status
    await db.exec`
      UPDATE content_items
      SET status = 'posted', updated_at = now()
      WHERE id = ${req.id}
    `;

    return log;
  }
);
