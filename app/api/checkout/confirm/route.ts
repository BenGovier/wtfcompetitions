import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confirmPaymentAndAward } from '@/lib/payments/confirmPaymentAndAward'
import type { AwardPayload } from '@/lib/payments/confirmPaymentAndAward'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

export async function POST(request: Request) {
  // 1) Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, ...NO_STORE })
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, ...NO_STORE })
  }

  const ref = body.ref as string | undefined
  const provider = body.provider as string | undefined
  const stripePaymentIntentId = body.stripePaymentIntentId as string | undefined
  const paypalOrderId = body.paypalOrderId as string | undefined

  if (!ref || typeof ref !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid ref' }, { status: 400, ...NO_STORE })
  }

  if (provider !== 'stripe' && provider !== 'paypal') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid provider (must be "stripe" or "paypal")' }, { status: 400, ...NO_STORE })
  }

  // 3) Call confirmPaymentAndAward
  try {
    const award: AwardPayload = await confirmPaymentAndAward({
      ref,
      userId: user.id,
      provider,
      stripePaymentIntentId,
      paypalOrderId,
    })

    return NextResponse.json({ ok: true, award }, NO_STORE)
  } catch (err: any) {
    const message = err?.message || ''

    if (message.includes('provider_verification_not_implemented')) {
      return NextResponse.json({ ok: false, error: 'awaiting_provider_confirmation' }, { status: 409, ...NO_STORE })
    }

    console.error('[checkout/confirm] Error:', message, err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}
