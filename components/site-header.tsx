import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Gift } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground transition-opacity hover:opacity-80">
          <Gift className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-xl">WTF Giveaways</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/giveaways" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Giveaways
          </Link>
          <Link href="/winners" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Winners
          </Link>
          <Link href="/about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex hover:bg-accent">
            <Link href="/me">Sign In</Link>
          </Button>
          <Button size="sm" asChild className="bg-primary text-primary-foreground shadow-sm hover:bg-[#5B21B6]">
            <Link href="/giveaways">Browse</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
