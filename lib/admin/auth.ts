import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin role model (code-only — DB values are managed manually).
 *
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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface AdminContext {
  user: User
  role: AdminRole
}

function normalizeRole(value: unknown): AdminRole | null {
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

/**
 * Reads the current authenticated user + their admin role from the
 * (user-scoped, RLS-respecting) server Supabase client.
 *
 * Returns null when there is no logged-in user, no admin_users row,
 * the row is disabled, or the role is unknown.
 */
export async function getAdminContext(
  supabaseClient?: SupabaseServerClient,
): Promise<AdminContext | null> {
  const supabase = supabaseClient ?? (await createClient())

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) return null

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) return null

  const role = normalizeRole(adminRow.role)
  if (!role) return null

  return { user, role }
}

/**
 * Server-side route guard for /admin pages.
 *
 * - Not authenticated  => redirect to login (with redirect back).
 * - Not an enabled/known admin, or role not allowed => redirect to /auth/unauthorized.
 *
 * Defaults to admin-only when no roles are supplied.
 */
export async function requireAdmin(opts?: {
  roles?: AdminRole[]
  redirectTo?: string
}): Promise<AdminContext> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(opts?.redirectTo ?? '/admin')}`)
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = adminRow && adminRow.is_enabled === true ? normalizeRole(adminRow.role) : null

  const allowed = opts?.roles ?? ['admin']
  if (!role || !allowed.includes(role)) {
    redirect('/auth/unauthorized')
  }

  return { user, role }
}

/**
 * API-route authorization guard.
 *
 * Keeps the historical `{ user, error }` shape used by existing routes, and
 * adds `role`. Defaults to admin-only when no roles are supplied.
 */
export async function authorizeAdminApi(
  supabase: SupabaseServerClient,
  opts?: { roles?: AdminRole[] },
): Promise<{ user: User | null; role: AdminRole | null; error: string | null }> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) return { user: null, role: null, error: 'Not authenticated' }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) {
    return { user: null, role: null, error: 'Not authorized' }
  }

  const role = normalizeRole(adminRow.role)
  const allowed = opts?.roles ?? ['admin']

  if (!role || !allowed.includes(role)) {
    return { user: null, role, error: 'Not authorized' }
  }

  return { user, role, error: null }
}
