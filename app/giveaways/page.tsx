import { SectionHeader } from "@/components/section-header"
import { GiveawayCard } from "@/components/giveaway-card"
import { SkeletonBlock } from "@/components/skeleton-block"
import { mockGiveaways } from "@/lib/mock-data"

export default function GiveawaysPage() {
  return (
    <div className="container px-4 py-8">
      <SectionHeader title="All Giveaways" subtitle="Browse all active giveaways and enter to win" />

      {/* Mock loading state (hidden by default) */}
      <div className="mt-8 hidden">
        <SkeletonBlock />
      </div>

      {/* Mock content */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mockGiveaways.map((giveaway) => (
          <GiveawayCard key={giveaway.slug} giveaway={giveaway} />
        ))}
      </div>
    </div>
  )
}
