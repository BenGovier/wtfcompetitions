import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

// Admin wallet APIs must never be cached by shared/proxy caches.
const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_QUERY_LEN = 200
const MAX_RESULTS = 25
// Bounded auth scan for email lookups (admin API has no email filter).
const EMAIL_SCAN_PER_PAGE = 200
const EMAIL_SCAN_MAX_PAGES = 25 // up to 5000 users scanned

/** Coerce a DB integer into a finite, safe, non-negative integer (defensive). */
function safeNonNegInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n < 0) return 0
  return n
}

type WalletTotals = { balance_pence: number; reserved_pence: number; available_pence: number }

function zeroTotals(): WalletTotals {
  return { balance_pence: 0, reserved_pence: 0, available_pence: 0 }
}

/** Batch-fetch wallet balances for a set of user ids. Missing rows => zeros. */
async function fetchWalletTotals(
  svc: SupabaseClient,
  userIds: string[],
): Promise<Record<string, WalletTotals>> {
  const out: Record<string, WalletTotals> = {}
  if (userIds.length === 0) return out
  const { data, error } = await svc
    .from('wallet_accounts')
    .select('user_id, balance_pence, reserved_pence')
    .in('user_id', userIds)
  if (error) {
    console.error('[admin/wallets/search] wallet_accounts fetch error:', error.message)
    return out
  }
  for (const row of data ?? []) {
    const balance = safeNonNegInt(row.balance_pence)
    const reserved = safeNonNegInt(row.reserved_pence)
    out[row.user_id] = {
      balance_pence: balance,
      reserved_pence: reserved,
      available_pence: Math.max(balance - reserved, 0),
    }
  }
  return out
}

/** Resolve email addresses for a bounded set of user ids (admin-only, capped). */
async function fetchEmails(svc: SupabaseClient, userIds: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  if (userIds.length === 0) return out
  const results = await Promise.allSettled(
    userIds.map(async (id) => {
      const { data, error } = await svc.auth.admin.getUserById(id)
      if (error) return { id, email: null }
      return { id, email: data?.user?.email ?? null }
    }),
  )
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value.id] = r.value.email
  }
  return out
}

type SearchResult = {
  user_id: string
  customer_name: string
  email: string
  balance_pence: number
  reserved_pence: number
  available_pence: number
}

export async function GET(request: NextRequest) {
  // Admin-only. Hosts (ops) and read_only are rejected.
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin/wallets/search] Missing Supabase config')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500, ...NO_STORE })
  }
  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { searchParams } = new URL(request.url)
  const rawQuery = searchParams.get('q') ?? ''
  const q = rawQuery.trim()

  if (q.length === 0) {
    return NextResponse.json({ ok: true, mode: 'empty', results: [], notice: null }, NO_STORE)
  }
  if (q.length > MAX_QUERY_LEN) {
    return NextResponse.json({ ok: false, error: 'query_too_long' }, { status: 400, ...NO_STORE })
  }

  try {
    let matchedUserIds: string[] = []
    let profileById: Record<string, { real_name: string | null }> = {}
    let emailById: Record<string, string | null> = {}
    let mode: 'uuid' | 'email' | 'name' = 'name'
    let notice: string | null = null

    if (UUID_RE.test(q)) {
      // === UUID: exact user lookup ===
      mode = 'uuid'
      const { data: authData, error: authErr } = await svc.auth.admin.getUserById(q)
      if (!authErr && authData?.user) {
        matchedUserIds = [authData.user.id]
        emailById[authData.user.id] = authData.user.email ?? null
      }
    } else if (q.includes('@')) {
      // === Email: bounded scan of auth users (partial/substring, case-insensitive) ===
      mode = 'email'
      const target = q.toLowerCase()
      const found: string[] = []
      for (let page = 1; page <= EMAIL_SCAN_MAX_PAGES; page++) {
        const { data, error } = await svc.auth.admin.listUsers({ page, perPage: EMAIL_SCAN_PER_PAGE })
        if (error) {
          console.error('[admin/wallets/search] listUsers error:', error.message)
          break
        }
        for (const u of data.users) {
          const email = (u.email ?? '').toLowerCase()
          if (email && email.includes(target)) {
            found.push(u.id)
            emailById[u.id] = u.email ?? null
            if (found.length >= MAX_RESULTS) break
          }
        }
        if (found.length >= MAX_RESULTS) break
        if (data.users.length < EMAIL_SCAN_PER_PAGE) break // last page reached
      }
      matchedUserIds = found
      notice =
        'Email search scans a bounded number of recent auth users. On very large user bases some matches beyond the scan limit may not appear; search by exact user ID for a guaranteed lookup.'
    } else {
      // === Name: profiles_private, bounded ilike ===
      mode = 'name'
      const { data: profiles, error: profErr } = await svc
        .from('profiles_private')
        .select('user_id, real_name')
        .ilike('real_name', `%${q}%`)
        .limit(MAX_RESULTS)
      if (profErr) {
        console.error('[admin/wallets/search] profiles_private search error:', profErr.message)
        return NextResponse.json({ ok: false, error: 'search_failed' }, { status: 500, ...NO_STORE })
      }
      matchedUserIds = (profiles ?? []).map((p) => p.user_id).filter(Boolean)
      profileById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, { real_name: p.real_name }]))
      emailById = await fetchEmails(svc, matchedUserIds)
    }

    matchedUserIds = [...new Set(matchedUserIds)].slice(0, MAX_RESULTS)

    if (matchedUserIds.length === 0) {
      return NextResponse.json({ ok: true, mode, results: [], notice }, NO_STORE)
    }

    // For UUID/email modes we still need the display name from profiles_private.
    if (Object.keys(profileById).length === 0) {
      const { data: profiles, error: profErr } = await svc
        .from('profiles_private')
        .select('user_id, real_name')
        .in('user_id', matchedUserIds)
      if (profErr) {
        console.error('[admin/wallets/search] profiles_private batch error (non-fatal):', profErr.message)
      } else {
        profileById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, { real_name: p.real_name }]))
      }
    }

    const totalsById = await fetchWalletTotals(svc, matchedUserIds)

    const results: SearchResult[] = matchedUserIds.map((id) => {
      const totals = totalsById[id] ?? zeroTotals()
      return {
        user_id: id,
        customer_name: profileById[id]?.real_name || 'Unknown',
        email: emailById[id] || '-',
        balance_pence: totals.balance_pence,
        reserved_pence: totals.reserved_pence,
        available_pence: totals.available_pence,
      }
    })

    return NextResponse.json({ ok: true, mode, results, notice }, NO_STORE)
  } catch (err: any) {
    console.error('[admin/wallets/search] Unexpected error:', err?.message || err)
    return NextResponse.json({ ok: false, error: 'search_failed' }, { status: 500, ...NO_STORE })
  }
}
