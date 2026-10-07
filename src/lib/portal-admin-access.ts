export const PORTAL_SUPER_ADMIN_EMAILS = [
  "hottacosmanagement@hotmail.com",
  "admin@nixinx.com",
  "admin@hottacosrestaurant.com",
] as const;

export function normalizePortalEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isPortalSuperAdminEmail(email: string | null | undefined) {
  const normalized = normalizePortalEmail(email);
  return PORTAL_SUPER_ADMIN_EMAILS.includes(
    normalized as (typeof PORTAL_SUPER_ADMIN_EMAILS)[number],
  );
}
