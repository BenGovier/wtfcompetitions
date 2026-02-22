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

  console.log('[checkout/confirm] caller user:', user?.id ?? null)

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

  if (!ref || typeof ref !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid ref' }, { status: 400, ...NO_STORE })
  }

  if (provider !== 'sumup' && provider !== 'paypal' && provider !== 'debug') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid provider' }, { status: 400, ...NO_STORE })
  }

  // 3) Call confirmPaymentAndAward
  console.log('[checkout/confirm] confirm attempt:', {
    ref,
    provider,
    callerUserId: user?.id ?? null,
  })

  try {
    const award: AwardPayload = await confirmPaymentAndAward({
      ref,
      userId: user.id,
      provider,
    })

    return NextResponse.json({ ok: true, award }, NO_STORE)
  } catch (err: any) {
    const message = err?.message || ''

    if (message.includes('awaiting_provider_confirmation')) {
      return NextResponse.json({ ok: false, error: 'awaiting_provider_confirmation' }, { status: 409, ...NO_STORE })
    }

    if (message.includes('user_id mismatch') || message.includes('caller does not own')) {
      return NextResponse.json({ ok: false, error: 'forbidden_checkout_intent_owner' }, { status: 403, ...NO_STORE })
    }

    console.error('[checkout/confirm] Error detail:', {
      message,
      ref,
      provider,
      callerUserId: user?.id ?? null,
    })
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}
