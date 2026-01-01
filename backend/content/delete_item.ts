import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface DeleteContentRequest {
  id: string;
}

// Deletes a content item.
export const deleteItem = api<DeleteContentRequest, void>(
  { expose: true, method: "DELETE", path: "/content/items/:id", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    await db.exec`DELETE FROM content_items WHERE id = ${req.id} AND created_by_user_id = ${authData.userID}`;
  }
);
