import { db } from "../db/db";

export async function tableExists(
  tableName: string,
  schema = "public"
): Promise<boolean> {
  const fullName = `${schema}.${tableName}`;
  const row = await db.queryRow<{ regclass: string | null }>`
    SELECT to_regclass(${fullName}) as regclass
  `;
  return Boolean(row?.regclass);
}
