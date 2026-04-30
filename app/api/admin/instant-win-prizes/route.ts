import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })

  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  if (!campaignId) return NextResponse.json({ ok: false, error: 'Missing campaignId' }, { status: 400 })

  const svc = getServiceSupabase()
  const { data, error } = await svc
    .from('instant_win_prizes')
    .select('id, campaign_id, prize_title, prize_value_text, unlock_ratio, image_url, quantity, is_high_value, created_at')
    .eq('campaign_id', campaignId)
    .order('unlock_ratio', { ascending: true })
    .order('created_at', { ascending: true })

  // Default quantity to 1 and is_high_value to false if null/undefined for backwards compatibility
  const items = (data ?? []).map((row: any) => ({
    ...row,
    quantity: row.quantity ?? 1,
    is_high_value: row.is_high_value ?? false,
  }))

  if (error) {
    console.error('[instant-win-prizes] GET error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, items })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const items: Record<string, any>[] = body.items ? body.items : [body]

  const rows = items.map((item) => ({
    campaign_id: item.campaign_id,
    prize_title: item.prize_title,
    prize_value_text: item.prize_value_text ?? null,
    unlock_ratio: item.unlock_ratio,
    image_url: item.image_url ?? null,
    quantity: item.quantity ?? 1,
    is_high_value: item.is_high_value ?? false,
  }))

  const svc = getServiceSupabase()
  const { data, error } = await svc
    .from('instant_win_prizes')
    .insert(rows)
    .select('id, campaign_id, prize_title, prize_value_text, unlock_ratio, image_url, quantity, is_high_value, created_at')

  if (error) {
    console.error('[instant-win-prizes] POST error:', error)
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, items: data })
}

export async function PUT(request: Request) {
  console.log('[instant-debug][prize-api] PUT hit')
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) {
    console.log('[instant-debug][prize-api] PUT auth failed:', authError)
    return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    console.log('[instant-debug][prize-api] PUT invalid JSON body')
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  console.log('[instant-debug][prize-api] PUT payload: id=', body.id, 'campaign_id=', body.campaign_id, 'prize_title=', body.prize_title, 'quantity=', body.quantity)

  if (!body.id || !body.campaign_id) {
    console.log('[instant-debug][prize-api] PUT missing id or campaign_id')
    return NextResponse.json({ ok: false, error: 'Missing id or campaign_id' }, { status: 400 })
  }

  const update: Record<string, any> = {}
  if (body.prize_title !== undefined) update.prize_title = body.prize_title
  if (body.prize_value_text !== undefined) update.prize_value_text = body.prize_value_text
  if (body.unlock_ratio !== undefined) update.unlock_ratio = body.unlock_ratio
  if (body.image_url !== undefined) update.image_url = body.image_url
  if (body.quantity !== undefined) update.quantity = body.quantity
  if (body.is_high_value !== undefined) update.is_high_value = body.is_high_value

  console.log('[instant-debug][prize-api] PUT update object:', JSON.stringify(update))

  const svc = getServiceSupabase()
  const { error } = await svc
    .from('instant_win_prizes')
    .update(update)
    .eq('id', body.id)
    .eq('campaign_id', body.campaign_id)

  if (error) {
    console.error('[instant-debug][prize-api] PUT DB error:', error)
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  console.log('[instant-debug][prize-api] PUT success, returning ok=true for id=', body.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const campaignId = searchParams.get('campaignId')
  if (!id || !campaignId) return NextResponse.json({ ok: false, error: 'Missing id or campaignId' }, { status: 400 })

  const svc = getServiceSupabase()
  const { error } = await svc
    .from('instant_win_prizes')
    .delete()
    .eq('id', id)
    .eq('campaign_id', campaignId)

  if (error) {
    console.error('[instant-win-prizes] DELETE error:', error)
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
