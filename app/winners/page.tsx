import { SectionHeader } from "@/components/section-header"
import { WinnerSpotlight } from "@/components/winner-spotlight"
import { WinnersPageClient } from "@/components/winners-page-client"
import { mockWinners } from "@/lib/mock-data"
import { ShieldCheck } from "lucide-react"

export default function WinnersPage() {
  const featuredWinner = mockWinners.find((w) => w.quote) || mockWinners[0]

  return (
    <div className="container px-4 py-8 md:py-12">
      {/* Hero / Trust Intro - Server Rendered */}
      <div className="mb-8 text-center md:mb-12">
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">Winners</h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-muted-foreground md:text-lg">
          Every winner is announced publicly with real names and verified identities. We believe in complete
          transparency and celebrating our community.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Winners announced publicly within 48 hours of each draw</span>
        </div>
      </div>

      {/* Featured Winner Spotlight - Server Rendered */}
      {featuredWinner && (
        <div className="mb-8 md:mb-12">
          <SectionHeader title="Featured Winner" className="mb-4" />
          <WinnerSpotlight winner={featuredWinner} />
        </div>
      )}

      {/* Client Component for Filtering */}
      <WinnersPageClient winners={mockWinners} featuredWinner={featuredWinner} />
    </div>
  )
}
