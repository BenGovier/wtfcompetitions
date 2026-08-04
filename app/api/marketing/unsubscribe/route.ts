import { NextResponse } from 'next/server'
import { parseUnsubscribeToken } from '@/lib/marketing/unsubscribe-token'
import { unsubscribeMarketingEmail } from '@/lib/marketing/service'
import { MARKETING_CONSENT_SOURCE } from '@/lib/marketing/consent'
import { rateLimit, getClientIp } from '@/lib/marketing/rate-limit'

export const runtime = 'nodejs'

/**
 * Public marketing unsubscribe endpoint.
 *
 *   POST { token }  ->  { ok: true }
 *
 * The only accepted input is the opaque, encrypted token — the caller never
 * sends a user id or email. We validate + decrypt server-side, then call the
 * idempotent unsubscribe function. It never requires login, is safe to call
 * repeatedly (repeat calls still return success), and never reveals whether an
 * account exists. A conservative IP rate limit blunts abuse.
 *
 * This is intentionally shaped so it can later back a standards-based one-click
 * unsubscribe (RFC 8058) POST — but no email headers are added in Stage 0
 * because no marketing sending capability exists yet.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`unsub:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null
  const payload = parseUnsubscribeToken(body?.token)

  // Invalid/tampered/expired token — reveal nothing about any account.
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 })
  }

  const result = await unsubscribeMarketingEmail({
    userId: payload.userId,
    emailLc: payload.emailLc,
    source: MARKETING_CONSENT_SOURCE.unsubscribeLink,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: 'unsubscribe_failed' }, { status: 500 })
  }

  // Same success response whether this was the first unsubscribe or a repeat.
  return NextResponse.json({ ok: true })
}
