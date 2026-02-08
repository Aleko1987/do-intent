import { api } from "encore.dev/api";
import type { EmptyRequest } from "../internal/empty_request";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { ContentItem } from "./types";

interface ListContentResponse {
  items: ContentItem[];
}

// Lists all content items.
export const list = api<EmptyRequest, ListContentResponse>(
  { expose: true, method: "GET", path: "/content/items", auth: true },
  async () => {
    const authData = getAuthData()!;
    const items = await db.queryAll<ContentItem & { channels: any }>`
      SELECT * FROM content_items
      WHERE created_by_user_id = ${authData.userID}
      ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
    `;

    const formattedItems = items.map((item) => ({
      ...item,
      channels: Array.isArray(item.channels) ? item.channels : [],
    }));

    return { items: formattedItems };
  }
);
