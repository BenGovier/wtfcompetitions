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
  const allowStagingBypass = process.env.VERCEL_ENV !== 'production'

  if (!allowStagingBypass) {
    const supabase = await createClient()
    const { user, error: authError } = await authorize(supabase)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: authError },
        { status: authError === 'Not authenticated' ? 401 : 403 }
      )
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase config' }, { status: 500 })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Fetch latest instant win awards first
  const { data: awards, error: awardsError } = await svc
    .from('instant_win_awards')
    .select('checkout_intent_id, prize_id, awarded_at')
    .order('awarded_at', { ascending: false })
    .limit(20)

  if (awardsError) {
    return NextResponse.json({ ok: false, error: awardsError.message }, { status: 500 })
  }

  if (!awards || awards.length === 0) {
    return NextResponse.json({ ok: true, items: [] })
  }

  // Get related entries by checkout_intent_id
  const checkoutIntentIds = [...new Set(awards.map((a) => a.checkout_intent_id).filter(Boolean))]
  const { data: entries } = await svc
    .from('entries')
    .select('id, checkout_intent_id, campaign_id, qty, created_at, user_id')
    .in('checkout_intent_id', checkoutIntentIds)

  const entryMap = new Map((entries ?? []).map((e) => [e.checkout_intent_id, e]))

  // Resolve campaign titles
  const campaignIds = [...new Set((entries ?? []).map((e) => e.campaign_id))]
  const { data: campaigns } = await svc
    .from('campaigns')
    .select('id, title')
    .in('id', campaignIds)

  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c.title]))

  // Resolve profile names from profiles_public_snapshot
  const userIds = [...new Set((entries ?? []).map((e) => e.user_id).filter(Boolean))]
  const { data: profiles } = await svc
    .from('profiles_public_snapshot')
    .select('user_id, real_name')
    .in('user_id', userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.real_name]))

  // Resolve prize titles
  const prizeIds = [...new Set(awards.map((a) => a.prize_id).filter(Boolean))]
  const { data: prizes } = await svc
    .from('instant_win_prizes')
    .select('id, prize_title')
    .in('id', prizeIds)

  const prizeMap = new Map((prizes ?? []).map((p) => [p.id, p.prize_title]))

  // Build response - only instant win events
  const items = awards
    .map((award) => {
      const entry = entryMap.get(award.checkout_intent_id)
      if (!entry) return null

      let userDisplay = 'User'
      if (entry.user_id) {
        const realName = profileMap.get(entry.user_id)
        userDisplay = realName || 'User'
      }

      return {
        id: entry.id,
        qty: entry.qty,
        created_at: entry.created_at,
        campaign_title: campaignMap.get(entry.campaign_id) ?? 'Unknown Campaign',
        user_display: userDisplay,
        won_instant_win: true,
        instant_win_title: prizeMap.get(award.prize_id) ?? null,
        awarded_at: award.awarded_at,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ ok: true, items }, {
    headers: {
      'Cache-Control': 'public, max-age=5, s-maxage=5',
    },
  })
}
