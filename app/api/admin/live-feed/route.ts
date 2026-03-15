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

  // Fetch latest entries
  const { data: entries, error: entriesError } = await svc
    .from('entries')
    .select('id, campaign_id, qty, created_at, user_id')
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

  // Build response
  const items = entries.map((e) => ({
    id: e.id,
    qty: e.qty,
    created_at: e.created_at,
    campaign_title: campaignMap.get(e.campaign_id) ?? 'Unknown Campaign',
  }))

  return NextResponse.json({ ok: true, items })
}
