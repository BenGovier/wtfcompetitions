import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function authorize(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { user: null, error: 'Not authenticated' }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) return { user: null, error: 'Not authorized' }

  return { user, error: null }
}

export async function GET() {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase config' }, { status: 500 })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Fetch latest entries with checkout_intent_id
  const { data: entries, error: entriesError } = await svc
    .from('entries')
    .select('id, checkout_intent_id, campaign_id, qty, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(20)

  if (entriesError) {
    return NextResponse.json({ ok: false, error: entriesError.message }, { status: 500 })
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, items: [] })
  }

  // Resolve campaign titles
  const campaignIds = [...new Set(entries.map((e) => e.campaign_id))]
  const { data: campaigns } = await svc
    .from('campaigns')
    .select('id, title')
    .in('id', campaignIds)

  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c.title]))

  // Resolve profile names from profiles_public_snapshot
  const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))]
  const { data: profiles } = await svc
    .from('profiles_public_snapshot')
    .select('user_id, real_name')
    .in('user_id', userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.real_name]))

  // Resolve auth user data (display_name + email) for all users
  const authUserMap = new Map<string, { displayName: string | null; email: string | null }>()

  for (const uid of userIds) {
    try {
      const { data: authUser } = await svc.auth.admin.getUserById(uid)
      if (authUser?.user) {
        const displayName = authUser.user.user_metadata?.display_name ?? null
        const email = authUser.user.email ?? null
        authUserMap.set(uid, { displayName, email })
      }
    } catch {
      // Ignore errors, fallback handled later
    }
  }

  // Resolve instant win awards by checkout_intent_id
  const checkoutIntentIds = [...new Set(entries.map((e) => e.checkout_intent_id).filter(Boolean))]
  const { data: awards } = await svc
    .from('instant_win_awards')
    .select('checkout_intent_id, prize_id, awarded_at')
    .in('checkout_intent_id', checkoutIntentIds)

  const awardMap = new Map((awards ?? []).map((a) => [a.checkout_intent_id, { prize_id: a.prize_id, awarded_at: a.awarded_at }]))

  // Resolve prize titles
  const prizeIds = [...new Set((awards ?? []).map((a) => a.prize_id).filter(Boolean))]
  const { data: prizes } = await svc
    .from('instant_win_prizes')
    .select('id, prize_title')
    .in('id', prizeIds)

  const prizeMap = new Map((prizes ?? []).map((p) => [p.id, p.prize_title]))

  // Build response
  const items = entries.map((e) => {
    const award = e.checkout_intent_id ? awardMap.get(e.checkout_intent_id) : null
    const wonInstantWin = !!award
    const instantWinTitle = award ? prizeMap.get(award.prize_id) ?? null : null
    const awardedAt = award?.awarded_at ?? null

    // Resolve user display: auth display_name > real_name > email > "User"
    let userDisplay = 'User'
    if (e.user_id) {
      const authData = authUserMap.get(e.user_id)
      const realName = profileMap.get(e.user_id)
      userDisplay = authData?.displayName || realName || authData?.email || 'User'
    }

    return {
      id: e.id,
      qty: e.qty,
      created_at: e.created_at,
      campaign_title: campaignMap.get(e.campaign_id) ?? 'Unknown Campaign',
      user_display: userDisplay,
      won_instant_win: wonInstantWin,
      instant_win_title: instantWinTitle,
      awarded_at: awardedAt,
    }
  })

  return NextResponse.json({ ok: true, items })
}
