"use client"

import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnersGrid } from "@/components/winners-grid"
import { SectionHeader } from "@/components/section-header"
import { ShieldCheck, ExternalLink, Ticket } from "lucide-react"

interface WinnersPageClientProps {
  winners: WinnerSnapshot[]
}

export function WinnersPageClient({ winners }: WinnersPageClientProps) {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <SectionHeader
          title="Live Wins"
          subtitle="Thousands of prizes already won — don&apos;t miss out"
        />
      </div>

      {/* Winners Feed */}
      <div className="mb-12">
        {winners.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No winners yet. Be the first!</p>
          </div>
        ) : (
          <WinnersGrid winners={winners} />
        )}
      </div>

      {/* Transparency Section */}
      <div className="mb-24 rounded-lg border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-balance text-xl font-semibold md:text-2xl">How Winners Are Chosen</h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              All winners are selected through a fair random drawing system. Each entry has an equal chance of winning.
              Winners are verified and announced publicly within 48 hours of each draw closing.
            </p>
            <Link
              href="/faq"
              className="mt-4 inline-flex items-center gap-1 rounded text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Learn more in our FAQ
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#1f0033]/95 backdrop-blur-md p-3 md:p-4">
        <Link
          href="/giveaways"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Ticket className="h-5 w-5" aria-hidden="true" />
          Enter Live Raffles
        </Link>
      </div>
    </>
  )
}
