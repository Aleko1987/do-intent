import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { ContentItem } from "./types";

interface UpdateContentRequest {
  id: string;
  title?: string;
  body?: string;
  creative_url?: string;
  channels?: string;
  status?: string;
  scheduled_at?: string;
  buffer_post_id?: string;
}

// Updates a content item.
export const update = api<UpdateContentRequest, ContentItem>(
  { expose: true, method: "PATCH", path: "/content/items/:id", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    const updates: string[] = [];
    const params: any[] = [req.id];
    let paramIndex = 2;

    if (req.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(req.title);
      paramIndex++;
    }

    if (req.body !== undefined) {
      updates.push(`body = $${paramIndex}`);
      params.push(req.body);
      paramIndex++;
    }

    if (req.creative_url !== undefined) {
      updates.push(`creative_url = $${paramIndex}`);
      params.push(req.creative_url);
      paramIndex++;
    }

    if (req.channels !== undefined) {
      let channels: string[] = [];
      if (req.channels) {
        try {
          const parsed = JSON.parse(req.channels) as string[];
          if (Array.isArray(parsed)) {
            channels = parsed.filter((value) => typeof value === "string");
          }
        } catch {
          channels = [];
        }
      }
      updates.push(`channels = $${paramIndex}`);
      params.push(JSON.stringify(channels));
      paramIndex++;
    }

    if (req.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(req.status);
      paramIndex++;
    }

    if (req.scheduled_at !== undefined) {
      updates.push(`scheduled_at = $${paramIndex}`);
      params.push(req.scheduled_at);
      paramIndex++;
    }

    if (req.buffer_post_id !== undefined) {
      updates.push(`buffer_post_id = $${paramIndex}`);
      params.push(req.buffer_post_id);
      paramIndex++;
    }

    updates.push("updated_at = now()");

    params.push(authData.userID);
    const query = `
      UPDATE content_items
      SET ${updates.join(", ")}
      WHERE id = $1 AND created_by_user_id = $${paramIndex}
      RETURNING *
    `;

    const item = await db.rawQueryRow<ContentItem & { channels: any }>(query, ...params);

    if (!item) {
      throw new Error("Content item not found");
    }

    return {
      ...item,
      channels: Array.isArray(item.channels) ? item.channels : [],
    };
  }
);
