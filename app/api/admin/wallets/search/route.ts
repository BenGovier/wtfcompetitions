import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

// Admin wallet APIs must never be cached by shared/proxy caches.
const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_QUERY_LEN = 200
const MIN_QUERY_LEN = 3
const MAX_RESULTS = 25

// The GoTrue admin users list (@supabase/auth-js) caps per_page server-side at
// 50 regardless of a larger requested value, so 50 is the largest safe page
// size actually honoured by the installed client.
const EMAIL_SCAN_PER_PAGE = 50

// Defensive ceiling to prevent a runaway request. This is NOT a silent result
// cutoff: if we hit it before the auth list genuinely ends AND before finding
// MAX_RESULTS matches, we return HTTP 503 `search_incomplete` rather than a
// partial result presented as complete. 50 * 4000 = 200,000 accounts scanned
// before the defensive limit engages.
const EMAIL_SCAN_MAX_PAGES = 4000

// A syntactically complete email address (used for the exact-match fast path).
const FULL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Control characters are rejected from free-text (non-UUID) queries.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/

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

  const isUuid = UUID_RE.test(q)
  // Validation for all non-UUID (email / name) searches.
  if (!isUuid) {
    if (CONTROL_CHAR_RE.test(q)) {
      return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400, ...NO_STORE })
    }
    if (q.length < MIN_QUERY_LEN) {
      return NextResponse.json({ ok: false, error: 'query_too_short' }, { status: 400, ...NO_STORE })
    }
  }

  try {
    let matchedUserIds: string[] = []
    let profileById: Record<string, { real_name: string | null }> = {}
    let emailById: Record<string, string | null> = {}
    let mode: 'uuid' | 'email' | 'name' = 'name'
    let notice: string | null = null

    if (isUuid) {
      // === UUID: exact user lookup ===
      mode = 'uuid'
      const { data: authData, error: authErr } = await svc.auth.admin.getUserById(q)
      if (!authErr && authData?.user) {
        matchedUserIds = [authData.user.id]
        emailById[authData.user.id] = authData.user.email ?? null
      }
    } else if (q.includes('@')) {
      // === Email: server-side pagination of the auth user list ===
      // The GoTrue admin API exposes no email filter, so we page through the
      // user list and match case-insensitively. We NEVER stop at an arbitrary
      // page count and pretend the search finished — the loop stops only when
      // (a) MAX_RESULTS matches are found, (b) an exact full-email match is
      // found, or (c) the auth list genuinely ends. If the defensive page
      // ceiling is hit before the list ends and before enough matches, we
      // signal `search_incomplete` (HTTP 503) instead of returning a partial
      // result as if it were complete.
      mode = 'email'
      const target = q.toLowerCase()
      const isFullEmail = FULL_EMAIL_RE.test(q)
      const found: string[] = []
      let exactMatchId: string | null = null

      let listEnded = false
      let listErrored = false
      let page = 1
      for (; page <= EMAIL_SCAN_MAX_PAGES; page++) {
        const { data, error } = await svc.auth.admin.listUsers({ page, perPage: EMAIL_SCAN_PER_PAGE })
        if (error) {
          // Do not surface raw auth errors; treat as a failed scan.
          console.error('[admin/wallets/search] listUsers error:', error.message)
          listErrored = true
          break
        }

        const users = data?.users ?? []
        for (const u of users) {
          const email = (u.email ?? '').toLowerCase()
          if (!email) continue

          // Exact full-email match: return immediately with just this account.
          if (isFullEmail && email === target) {
            exactMatchId = u.id
            emailById[u.id] = u.email ?? null
            break
          }

          // Otherwise accumulate case-insensitive substring matches (bounded).
          if (email.includes(target)) {
            found.push(u.id)
            emailById[u.id] = u.email ?? null
            if (found.length >= MAX_RESULTS) break
          }
        }

        if (exactMatchId) break
        if (found.length >= MAX_RESULTS) break

        // Authoritative end-of-list detection. GoTrue sets `nextPage` to a
        // number when another page exists and to null on the final page. The
        // short-page check is a belt-and-braces secondary signal.
        const noNextPage = (data as { nextPage?: number | null })?.nextPage == null
        if (noNextPage || users.length < EMAIL_SCAN_PER_PAGE) {
          listEnded = true
          break
        }
      }

      if (listErrored) {
        return NextResponse.json({ ok: false, error: 'search_failed' }, { status: 500, ...NO_STORE })
      }

      if (exactMatchId) {
        matchedUserIds = [exactMatchId]
      } else {
        // We may safely return the results IF the scan completed: either the
        // auth list genuinely ended, or we already found the maximum allowed
        // number of matches (the endpoint intentionally caps results at 25).
        const scanCompleted = listEnded || found.length >= MAX_RESULTS
        if (!scanCompleted) {
          // Defensive ceiling reached without finishing — never pretend success.
          return NextResponse.json(
            {
              ok: false,
              error: 'search_incomplete',
              message:
                'The customer search could not scan every account. Please use a more specific email address.',
            },
            { status: 503, ...NO_STORE },
          )
        }
        matchedUserIds = found
      }
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
