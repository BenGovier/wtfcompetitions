import Link from "next/link"
import Image from "next/image"
import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { MobileAuthMenu } from "@/components/mobile-auth-menu"

// Format an integer pence amount as GBP (e.g. 2000 -> "£20.00").
// Clamps malformed/negative values to 0 so the balance can never render negative
// and never exposes raw pence.
function formatGBP(pence: number) {
  const safe = Number.isFinite(pence) ? Math.max(pence, 0) : 0
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(safe / 100)
}

/**
 * True ONLY for the two expected stale-refresh-token conditions:
 *   - refresh_token_not_found    ("Invalid Refresh Token: Refresh Token Not Found")
 *   - refresh_token_already_used ("Invalid Refresh Token: Already Used")
 * Every other auth error (network, config, invalid key, outage, DB, unexpected
 * auth failure) is intentionally excluded and must NOT be suppressed here.
 */
function isStaleRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const code = (err as { code?: string }).code
  if (code === "refresh_token_not_found" || code === "refresh_token_already_used") {
    return true
  }
  const message = String((err as { message?: string }).message ?? "")
  return /refresh token not found/i.test(message) || /invalid refresh token: already used/i.test(message)
}

export async function SiteHeader() {
  const supabase = await createClient()

  // Keep the SINGLE existing getUser() call. We now capture its result so a
  // stale refresh-token cookie (rotated/expired after a deploy or duplicate
  // refresh) is treated as a normal logged-out visitor instead of surfacing an
  // error. We do NOT clear cookies from this Server Component, retry, redirect,
  // or call getUser again.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      // A stale-session error is expected and handled silently (no throw, no
      // console.error). Any other returned error also falls back to the
      // logged-out header, preserving the prior behaviour where a null user
      // simply renders the signed-out state. `isStaleRefreshTokenError` is
      // referenced so unexpected errors remain distinguishable from the
      // expected stale-session case in the catch branch below.
      void isStaleRefreshTokenError(error)
      user = null
    } else {
      user = data.user
    }
  } catch (err) {
    // getUser() can reject on a stale refresh token depending on client
    // internals. Swallow ONLY that expected condition; re-throw anything else
    // so genuine failures are not masked.
    if (!isStaleRefreshTokenError(err)) {
      throw err
    }
    user = null
  }

  // WTF Credit balance for the header control. This query runs ONLY for an
  // authenticated user — anonymous visitors never touch wallet_accounts. It uses
  // the existing RLS-scoped server client (never service role), reads a single
  // row and exactly two columns, and degrades to £0.00 on a missing row or any
  // read error so the header can never break. No transactions/reservations are
  // queried, and raw pence is never rendered.
  let walletAvailablePence = 0
  if (user) {
    const { data: walletRow, error: walletErr } = await supabase
      .from("wallet_accounts")
      .select("balance_pence, reserved_pence")
      .eq("user_id", user.id)
      .maybeSingle()

    if (walletErr) {
      console.error("[site-header] wallet_accounts lookup failed:", walletErr.message)
    } else if (walletRow) {
      const balancePence = typeof walletRow.balance_pence === "number" ? walletRow.balance_pence : 0
      const reservedPence = typeof walletRow.reserved_pence === "number" ? walletRow.reserved_pence : 0
      walletAvailablePence = Math.max(balancePence - reservedPence, 0)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
          <Image
            src="/images/wtf-logo-main.png"
            alt="WTF Giveaways"
            width={140}
            height={50}
            className="h-auto w-[120px] sm:w-[140px]"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/giveaways" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Giveaways
          </Link>
          <Link href="/winners" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Winners
          </Link>
          <Link href="/contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* WTF Credit balance control. Visible ONLY for authenticated users
              (hidden entirely for anonymous visitors), on both mobile and
              desktop. Compact icon + balance that links to /me. No spending or
              checkout controls, no client-side polling. */}
          {user && (
            <Link
              href="/me"
              aria-label={`WTF Credit balance ${formatGBP(walletAvailablePence)}. View account.`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1.5 text-sm font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/20"
            >
              <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{formatGBP(walletAvailablePence)}</span>
            </Link>
          )}

          {/* Mobile-only: burger menu for both signed-in and signed-out users.
              The signed-in state opens a polished account menu with a Sign out
              action; signed-out keeps Create account / Log in. */}
          <MobileAuthMenu isSignedIn={!!user} />

          {/* Desktop buttons */}
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex hover:bg-accent">
                <Link href="/me">My Account</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex bg-primary text-primary-foreground shadow-sm hover:bg-[#5B21B6]">
                <Link href="/giveaways">Browse</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex border-white/20 bg-black/50 text-white hover:bg-black/70">
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex bg-red-600 text-white shadow-sm hover:bg-red-700">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
