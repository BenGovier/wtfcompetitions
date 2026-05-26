import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { MobileAuthMenu } from "@/components/mobile-auth-menu"

export async function SiteHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
          {/* Mobile-only: burger menu for signed-out, Account button for signed-in */}
          {user ? (
            <Button variant="outline" size="sm" asChild className="sm:hidden border-white/20 bg-black/50 text-white hover:bg-black/70 text-xs px-3">
              <Link href="/me">Account</Link>
            </Button>
          ) : (
            <MobileAuthMenu />
          )}

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
