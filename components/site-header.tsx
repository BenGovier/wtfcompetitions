import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Gift } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <Gift className="h-6 w-6 text-brand" aria-hidden="true" />
          <span className="text-xl">WTF Giveaways</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/giveaways" className="text-sm font-medium transition-colors hover:text-brand">
            Giveaways
          </Link>
          <Link href="/winners" className="text-sm font-medium transition-colors hover:text-brand">
            Winners
          </Link>
          <Link href="/about" className="text-sm font-medium transition-colors hover:text-brand">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/me">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/giveaways">Browse</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
