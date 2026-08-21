/**
 * Organization selection lifecycle.
 *
 * The selected organization ID is the only piece of org state persisted on the
 * client. It is always validated against the authoritative list returned by
 * GET /integrations/organizations before any org-scoped request is issued —
 * never trusted straight out of storage, and never allowed to be `0` or any
 * other sentinel (that is what produced the /organizations/0/... 403 loop).
 */

export const ORG_STORAGE_KEY = "secureflow.organization_id";

/** Keys written by the OAuth handoff / older builds that must not survive a reset. */
const PENDING_KEYS = [
  "secureflow.pending_organization_id",
  "secureflow.oauth_organization_id",
  "secureflow.oauth_provider",
];

/** A usable org ID is a positive integer. Anything else is treated as absent. */
export function normalizeOrgId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function readStoredOrgId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeOrgId(window.localStorage.getItem(ORG_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredOrgId(id: number | null) {
  if (typeof window === "undefined") return;
  try {
    const valid = normalizeOrgId(id);
    if (valid) window.localStorage.setItem(ORG_STORAGE_KEY, String(valid));
    else window.localStorage.removeItem(ORG_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Drops the selected org plus any half-finished OAuth handoff state. */
export function clearOrganizationState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ORG_STORAGE_KEY);
    for (const k of PENDING_KEYS) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable */
  }
}
