/** Internal-only access: emails in INTERNAL_EMAILS (comma-separated) see ops/revenue. */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.INTERNAL_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
