export const WEBSITE_OWNER_USER_ID_FALLBACK = "user_39kcwJnyCHbVS0fuYG6a5fJsD2O";

export function resolveWebsiteOwnerUserId(): string {
  const configuredOwner = process.env.WEBSITE_OWNER_USER_ID?.trim();
  if (configuredOwner && configuredOwner.length > 0) {
    return configuredOwner;
  }
  return WEBSITE_OWNER_USER_ID_FALLBACK;
}
