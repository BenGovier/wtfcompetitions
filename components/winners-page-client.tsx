"use client"

import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnersGrid } from "@/components/winners-grid"
import { ShieldCheck, ExternalLink, Ticket, Flame } from "lucide-react"

interface WinnersPageClientProps {
  winners: WinnerSnapshot[]
}

export function WinnersPageClient({ winners }: WinnersPageClientProps) {
  return (
    <>
      {/* Premium Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-yellow-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white md:text-3xl">Live Wins</h1>
        </div>
        <p className="mt-1 text-sm font-medium text-white/60">
          Thousands of prizes already won — don&apos;t miss out
        </p>
      </div>

      {/* Winners Feed - extra bottom padding for sticky CTA + mobile nav */}
      <div className="pb-40 md:pb-12">
        <WinnersGrid winners={winners} />
      </div>

      {/* Transparency Section */}
      <div className="mb-40 md:mb-12 rounded-xl border border-white/10 bg-[#1a0a2e]/80 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
            <ShieldCheck className="h-5 w-5 text-purple-400" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">How Winners Are Chosen</h2>
            <p className="mt-2 text-sm text-white/60">
              All winners are selected through a fair random drawing system. Each entry has an equal chance of winning.
              Winners are verified and announced publicly within 48 hours of each draw closing.
            </p>
            <Link
              href="/faq"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-400 hover:text-purple-300 hover:underline"
            >
              Learn more in our FAQ
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Mobile CTA - positioned above mobile nav (which is ~56px) */}
      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-yellow-500/20 bg-[#1a0a2e]/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md md:bottom-0 md:border-white/10 md:bg-[#1f0033]/95 md:p-4">
        <Link
          href="/giveaways"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500 to-amber-500 px-6 py-3 text-base font-bold text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] active:scale-[0.98]"
        >
          <Ticket className="h-5 w-5" aria-hidden="true" />
          Enter Live Raffles
        </Link>
      </div>
    </>
  )
}
