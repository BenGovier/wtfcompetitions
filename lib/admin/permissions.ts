// Touch to force redeploy — no functional change.
/**
 * Client-safe admin role utilities.
 *
 * This file MUST NOT import any server-only modules (next/headers,
 * lib/supabase/server, next/navigation redirect, etc.) so it can be safely
 * imported by client components such as AdminSidebarNav.
 *
 * Admin role model (code-only — DB values are managed manually):
 *  - 'admin'     => full admin access to every /admin route + API
 *  - 'ops'       => "Host" (UI label). Live-feed-only access.
 *  - 'read_only' => reserved / no access for now
 *
 * NOTE: never surface the raw 'ops' value in the UI. Use ROLE_LABELS / "Host".
 */
export type AdminRole = 'admin' | 'ops' | 'read_only'

export const ADMIN_ROLES: AdminRole[] = ['admin', 'ops', 'read_only']

/** User-facing labels. 'ops' is always shown as "Host". */
export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  ops: 'Host',
  read_only: 'Read Only',
}

/** The internal role value used when saving a Host. */
export const HOST_ROLE: AdminRole = 'ops'

/** Routes a Host (ops) is allowed to reach. Admins can reach everything. */
export const HOST_ALLOWED_ROUTES = ['/admin/live-feed']

/** Normalizes an unknown value into a known AdminRole, or null. */
export function normalizeRole(value: unknown): AdminRole | null {
  return ADMIN_ROLES.includes(value as AdminRole) ? (value as AdminRole) : null
}

/**
 * Returns true if the given role may access the given pathname.
 * Admin => everything. Host (ops) => only HOST_ALLOWED_ROUTES. read_only => nothing.
 */
export function canAccessRoute(role: AdminRole | null, pathname: string): boolean {
  if (role === 'admin') return true
  if (role === 'ops') {
    return HOST_ALLOWED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  }
  return false
}

/** Returns true if the role may access the admin area at all. */
export function canAccessAdmin(role: AdminRole | null): boolean {
  return role === 'admin' || role === 'ops'
}
