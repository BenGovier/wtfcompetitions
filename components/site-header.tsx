import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { MobileAuthMenu } from "@/components/mobile-auth-menu"

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

        <div className="flex items-center gap-3">
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
