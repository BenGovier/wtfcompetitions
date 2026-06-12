'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi, HOST_ROLE } from '@/lib/admin/auth'

export interface HostRow {
  user_id: string
  email: string | null
  is_enabled: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Full-admin-only guard for every Host management action. */
async function requireFullAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { user, error } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return { ok: false, error: error === 'Not authenticated' ? 'Not authenticated' : 'Not authorized' }
  }
  return { ok: true }
}

/**
 * Look up an auth user id by email using the service client.
 * Scans listUsers pages (bounded) since admin API has no direct email filter.
 */
async function findUserIdByEmail(
  svc: ReturnType<typeof getServiceClient>,
  email: string,
): Promise<string | null> {
  if (!svc) return null
  const target = email.trim().toLowerCase()
  const perPage = 200
  const maxPages = 25 // safety cap (up to 5000 users scanned)

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[hosts/actions] listUsers error:', error.message)
      return null
    }
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < perPage) break // last page reached
  }
  return null
}

/** List all Host (ops) users with their email + enabled status. */
export async function listHosts(): Promise<{ ok: boolean; hosts?: HostRow[]; error?: string }> {
  const auth = await requireFullAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const svc = getServiceClient()
  if (!svc) return { ok: false, error: 'Server configuration error' }

  const { data: rows, error } = await svc
    .from('admin_users')
    .select('user_id, is_enabled')
    .eq('role', HOST_ROLE)

  if (error) {
    console.error('[hosts/actions] list error:', error.message)
    return { ok: false, error: 'Failed to load hosts' }
  }

  const hosts: HostRow[] = await Promise.all(
    (rows ?? []).map(async (row) => {
      let email: string | null = null
      try {
        const { data } = await svc.auth.admin.getUserById(row.user_id)
        email = data?.user?.email ?? null
      } catch {
        email = null
      }
      return { user_id: row.user_id, email, is_enabled: row.is_enabled === true }
    }),
  )

  hosts.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))

  return { ok: true, hosts }
}

/** Add a Host by email. Saves role='ops' internally (UI shows "Host"). */
export async function addHostByEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireFullAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { ok: false, error: 'Please enter a valid email address' }
  }

  const svc = getServiceClient()
  if (!svc) return { ok: false, error: 'Server configuration error' }

  const userId = await findUserIdByEmail(svc, email)
  if (!userId) {
    return { ok: false, error: 'No account found with that email. The user must register first.' }
  }

  // Don't override an existing admin/role row unless it's already a host.
  const { data: existing, error: existingErr } = await svc
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingErr) {
    console.error('[hosts/actions] existing lookup error:', existingErr.message)
    return { ok: false, error: 'Failed to verify existing access' }
  }

  if (existing && existing.role && existing.role !== HOST_ROLE) {
    return { ok: false, error: 'This user already has a different admin role and cannot be set as a Host here.' }
  }

  const { error: upsertErr } = await svc
    .from('admin_users')
    .upsert(
      { user_id: userId, role: HOST_ROLE, is_enabled: true },
      { onConflict: 'user_id' },
    )

  if (upsertErr) {
    console.error('[hosts/actions] upsert error:', upsertErr.message)
    return { ok: false, error: 'Failed to add host' }
  }

  revalidatePath('/admin/hosts')
  return { ok: true }
}

/** Enable or disable a Host. Only affects rows whose role is 'ops'. */
export async function setHostEnabled(
  userId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireFullAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  if (!userId || typeof userId !== 'string') {
    return { ok: false, error: 'Invalid user' }
  }

  const svc = getServiceClient()
  if (!svc) return { ok: false, error: 'Server configuration error' }

  const { error } = await svc
    .from('admin_users')
    .update({ is_enabled: enabled })
    .eq('user_id', userId)
    .eq('role', HOST_ROLE) // safety: never touch full admins

  if (error) {
    console.error('[hosts/actions] setHostEnabled error:', error.message)
    return { ok: false, error: 'Failed to update host' }
  }

  revalidatePath('/admin/hosts')
  return { ok: true }
}

/** Remove a Host entirely. Only deletes rows whose role is 'ops'. */
export async function removeHost(userId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireFullAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  if (!userId || typeof userId !== 'string') {
    return { ok: false, error: 'Invalid user' }
  }

  const svc = getServiceClient()
  if (!svc) return { ok: false, error: 'Server configuration error' }

  const { error } = await svc
    .from('admin_users')
    .delete()
    .eq('user_id', userId)
    .eq('role', HOST_ROLE) // safety: never delete full admins

  if (error) {
    console.error('[hosts/actions] removeHost error:', error.message)
    return { ok: false, error: 'Failed to remove host' }
  }

  revalidatePath('/admin/hosts')
  return { ok: true }
}
