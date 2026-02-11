import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function handleJobProcessing(request: NextRequest) {
  // Debug info
  const method = request.method
  const url = request.nextUrl.pathname + request.nextUrl.search
  const userAgent = request.headers.get('user-agent')
  const xVercelCron = request.headers.get('x-vercel-cron')
  const xVercelCronJob = request.headers.get('x-vercel-cron-job')
  const hasAuthorization = Boolean(request.headers.get('authorization'))

  console.log(`[jobs/run] method=${method} url=${url} ua=${userAgent} x-vercel-cron=${xVercelCron} x-vercel-cron-job=${xVercelCronJob} hasAuth=${hasAuthorization}`)

  // 1. Verify authorization
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  // A) Manual trigger: valid Bearer token
  const isManualTrigger = !!(expectedToken && authHeader === `Bearer ${expectedToken}`)

  // B) Vercel cron trigger: accept if ANY of these is true
  const isVercelCron =
    request.headers.get('x-vercel-cron') === '1' ||
    request.headers.has('x-vercel-cron-job') ||
    (request.headers.get('user-agent') ?? '').includes('vercel-cron')

  if (!isManualTrigger && !isVercelCron) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: { method, url, ua: userAgent, xVercelCron, xVercelCronJob, hasAuthorization }
    }, { status: 401 })
  }

  // 2. Create Supabase client with SERVICE ROLE key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })

  try {
    // 3. Lock ONE eligible job
    const now = new Date().toISOString()
    const lockDuration = 60 // seconds
    const lockedUntil = new Date(Date.now() + lockDuration * 1000).toISOString()

    // Find eligible job
    const { data: eligibleJobs, error: selectError } = await supabase
      .from('jobs')
      .select('id, type, payload, attempts, max_attempts')
      .eq('status', 'queued')
      .lte('run_after', now)
      .or(`locked_until.is.null,locked_until.lt."${now}"`)
      .order('created_at', { ascending: true })
      .limit(1)

    if (selectError) {
      console.error('[v0] Error selecting eligible job:', selectError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!eligibleJobs || eligibleJobs.length === 0) {
      return new NextResponse(null, { status: 204 })
    }

    const job = eligibleJobs[0]

    // Lock the job
    const { data: lockedJob, error: lockError } = await supabase
      .from('jobs')
      .update({
        locked_at: now,
        locked_until: lockedUntil,
        locked_by: 'api/jobs/run',
        status: 'running',
        updated_at: now
      })
      .eq('id', job.id)
      .eq('status', 'queued')
      .or(`locked_until.is.null,locked_until.lt."${now}"`)
      .select()
      .single()

    if (lockError || !lockedJob) {
      // Job was locked by another process
      return new NextResponse(null, { status: 204 })
    }

    // 4. Process the job
    try {
      if (job.type === 'REFRESH_SNAPSHOTS') {
        await processRefreshSnapshots(supabase, job.payload)
      } else {
        throw new Error(`Unknown job type: ${job.type}`)
      }

      // 5. Mark job as succeeded
      await supabase
        .from('jobs')
        .update({
          status: 'succeeded',
          updated_at: new Date().toISOString(),
          locked_until: null,
          last_error: null
        })
        .eq('id', job.id)

      return NextResponse.json({
        ok: true,
        processed: job.type,
        jobId: job.id
      })

    } catch (processingError) {
      // Handle job failure
      const errorMessage = processingError instanceof Error 
        ? processingError.message.substring(0, 1000)
        : 'Unknown error'

      const newAttempts = job.attempts + 1
      const isFailed = newAttempts >= job.max_attempts

      await supabase
        .from('jobs')
        .update({
          attempts: newAttempts,
          last_error: errorMessage,
          status: isFailed ? 'failed' : 'queued',
          run_after: isFailed ? null : new Date(Date.now() + 30000).toISOString(),
          locked_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (isFailed) {
        console.error(`[v0] Job ${job.id} failed after ${newAttempts} attempts:`, errorMessage)
      }

      return NextResponse.json({
        ok: true,
        processed: job.type,
        jobId: job.id,
        failed: isFailed
      })
    }

  } catch (error) {
    console.error('[v0] Unexpected error in job processing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handleJobProcessing(request)
}

export async function POST(request: NextRequest) {
  return handleJobProcessing(request)
}

async function processRefreshSnapshots(
  supabase: ReturnType<typeof createClient>,
  payload: any
) {
  const giveawayId = payload?.giveawayId

  // Build query
  let query = supabase
    .from('giveaways')
    .select('id, slug, title, prize_title, prize_value_text, hero_image_url, images, variant, status, starts_at, ends_at, currency, base_ticket_price_pence, bundles, hard_cap_total_tickets')

  if (giveawayId) {
    query = query.eq('id', giveawayId)
  }

  const { data: giveaways, error: fetchError } = await query

  if (fetchError) {
    throw new Error(`Failed to fetch giveaways: ${fetchError.message}`)
  }

  if (!giveaways || giveaways.length === 0) {
    console.log('[v0] No giveaways to refresh')
    return
  }

  // Process each giveaway
  for (const giveaway of giveaways) {
    const publicPayload = {
      id: giveaway.id,
      slug: giveaway.slug,
      title: giveaway.title,
      prize_title: giveaway.prize_title,
      prize_value_text: giveaway.prize_value_text,
      hero_image_url: giveaway.hero_image_url,
      images: giveaway.images,
      variant: giveaway.variant,
      status: giveaway.status,
      starts_at: giveaway.starts_at,
      ends_at: giveaway.ends_at,
      currency: giveaway.currency,
      base_ticket_price_pence: giveaway.base_ticket_price_pence,
      bundles: giveaway.bundles,
      hard_cap_total_tickets: giveaway.hard_cap_total_tickets
    }

    // Delete existing snapshot for this giveaway/kind
    await supabase
      .from('giveaway_snapshots')
      .delete()
      .eq('giveaway_id', giveaway.id)
      .eq('kind', 'public')

    // Insert new snapshot
    const { error: upsertError } = await supabase
      .from('giveaway_snapshots')
      .insert({
        giveaway_id: giveaway.id,
        kind: 'public',
        generated_at: new Date().toISOString(),
        payload: publicPayload
      })

    if (upsertError) {
      throw new Error(`Failed to upsert snapshot for giveaway ${giveaway.id}: ${upsertError.message}`)
    }
  }

  console.log(`[v0] Refreshed ${giveaways.length} giveaway snapshot(s)`)
}
