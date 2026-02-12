import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function toDbRow(body: Record<string, any>) {
  return {
    status: body.status,
    title: body.title,
    slug: body.slug,
    summary: body.summary,
    description: body.description,
    start_at: body.startAt,
    end_at: body.endAt,
    main_prize_title: body.mainPrizeTitle,
    main_prize_description: body.mainPrizeDescription,
    hero_image_url: body.heroImageUrl,
    ticket_price_pence: body.ticketPricePence,
    max_tickets_total: body.maxTicketsTotal ?? null,
    max_tickets_per_user: body.maxTicketsPerUser ?? null,
  }
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

async function enqueueRefreshSnapshots() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[jobs] missing supabaseUrl or service role key')
    return
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const nowIso = new Date().toISOString()

  const { error } = await svc
    .from('jobs')
    .upsert({
      type: 'REFRESH_SNAPSHOTS',
      payload: {},
      dedupe_key: 'REFRESH_SNAPSHOTS:campaigns',
      status: 'queued',
      attempts: 0,
      max_attempts: 3,
      run_after: nowIso,
      locked_until: null,
      locked_at: null,
      locked_by: null,
      updated_at: nowIso,
    }, { onConflict: 'dedupe_key' })

  if (error) console.error('[jobs] failed to enqueue REFRESH_SNAPSHOTS', error)
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

  const row = toDbRow(body)

  const { data, error } = await supabase
    .from('campaigns')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  await enqueueRefreshSnapshots()

  return NextResponse.json({ ok: true, id: data.id })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, error: 'Missing campaign id' }, { status: 400 })
  }

  const row = toDbRow(body)

  const { error } = await supabase
    .from('campaigns')
    .update(row)
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  await enqueueRefreshSnapshots()

  return NextResponse.json({ ok: true, id: body.id })
}
