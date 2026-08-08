// Touch to force redeploy — no functional change.
/**
 * Client-safe admin role utilities.
 *
 * This file MUST NOT import any server-only modules (next/headers,
 * lib/supabase/server, next/navigation redirect, etc.) so it can be safely
 * imported by client components such as AdminSidebarNav.
 *
 * Admin role model (code-only — DB values are managed manually):
 *  - 'admin'            => "Super Admin". Full access to every /admin route + API.
 *  - 'operations_admin' => "Operations Admin". Operational access only
 *                          (payouts, instant winners, entries, wallets, live feed).
 *                          Blocked from dashboard, campaigns, reports, hosts,
 *                          audit logs, and permanent payout deletion.
 *  - 'ops'              => "Host" (UI label). Live-feed-only access.
 *  - 'read_only'        => reserved / no access for now
 *
 * NOTE: never surface the raw 'ops' value in the UI. Use ROLE_LABELS / "Host".
 */
export type AdminRole = 'admin' | 'operations_admin' | 'ops' | 'read_only'

export const ADMIN_ROLES: AdminRole[] = ['admin', 'operations_admin', 'ops', 'read_only']

/** User-facing labels. 'ops' is always shown as "Host". */
export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Super Admin',
  operations_admin: 'Operations Admin',
  ops: 'Host',
  read_only: 'Read Only',
}

/** The internal role value used when saving a Host. */
export const HOST_ROLE: AdminRole = 'ops'

/** Routes a Host (ops) is allowed to reach. Admins can reach everything. */
export const HOST_ALLOWED_ROUTES = ['/admin/live-feed']

/**
 * Routes an Operations Admin is allowed to reach.
 *
 * Matching uses exact-or-prefix semantics (see canAccessRoute): a route entry
 * matches its own path exactly and any descendant path (`${route}/...`). It
 * deliberately does NOT include '/admin', so the dashboard and every other
 * admin route stay blocked unless explicitly listed here.
 */
export const OPERATIONS_ADMIN_ALLOWED_ROUTES = [
  '/admin/payouts',
  '/admin/instant-wins',
  '/admin/entries',
  '/admin/wallets',
  '/admin/live-feed',
  // Operations Admin works the support Inbox alongside admins. Hosts (ops) and
  // read_only get no access. Enforcement is mirrored on every /api/admin/inbox
  // route via authorizeAdminApi({ roles: ['admin', 'operations_admin'] }).
  '/admin/inbox',
  // Operations Admin may browse the customer directory and open individual
  // customers. The self-exclusion ACTION remains admin-only, enforced at the
  // dialog + wallet self-exclude API layer, never by nav visibility alone.
  '/admin/customers',
  // Operations Admin may VIEW discount codes (read-only). Mutations are still
  // blocked at the page + API layer (admin-only), never by nav visibility alone.
  '/admin/discount-codes',
]

/** Normalizes an unknown value into a known AdminRole, or null. */
export function normalizeRole(value: unknown): AdminRole | null {
  return ADMIN_ROLES.includes(value as AdminRole) ? (value as AdminRole) : null
}

/**
 * Returns true if the given role may access the given pathname.
 *
 * - admin            => everything.
 * - operations_admin => only OPERATIONS_ADMIN_ALLOWED_ROUTES (exact or descendant).
 * - ops (Host)       => only HOST_ALLOWED_ROUTES (exact or descendant).
 * - read_only / null => nothing.
 *
 * This is a usability control for navigation only. Server-side guards
 * (requireAdmin / authorizeAdminApi) remain the authoritative enforcement.
 */
export function canAccessRoute(role: AdminRole | null, pathname: string): boolean {
  if (role === 'admin') return true

  const matches = (routes: string[]) =>
    routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (role === 'operations_admin') return matches(OPERATIONS_ADMIN_ALLOWED_ROUTES)
  if (role === 'ops') return matches(HOST_ALLOWED_ROUTES)
  return false
}

/** Returns true if the role may access the admin area at all. */
export function canAccessAdmin(role: AdminRole | null): boolean {
  return role === 'admin' || role === 'operations_admin' || role === 'ops'
}
