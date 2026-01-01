import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ContentItem } from "./types";

interface CreateContentRequest {
  title: string;
  body?: string;
  creative_url?: string;
  channels?: string[];
  cta_type?: string;
  target_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  scheduled_at?: string;
}

// Creates a new content item.
export const create = api<CreateContentRequest, ContentItem>(
  { expose: true, method: "POST", path: "/content/items", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    const item = await db.queryRow<ContentItem & { channels: any }>`
      INSERT INTO content_items (
        title,
        body,
        creative_url,
        channels,
        cta_type,
        target_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        scheduled_at,
        status,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${req.title},
        ${req.body || null},
        ${req.creative_url || null},
        ${JSON.stringify(req.channels || [])},
        ${req.cta_type || null},
        ${req.target_url || null},
        ${req.utm_source || null},
        ${req.utm_medium || null},
        ${req.utm_campaign || null},
        ${req.utm_content || null},
        ${req.scheduled_at || null},
        'draft',
        ${authData.userID},
        now(),
        now()
      )
      RETURNING *
    `;

    if (!item) {
      throw new Error("Failed to create content item");
    }

    return {
      ...item,
      channels: Array.isArray(item.channels) ? item.channels : [],
    };
  }
);
