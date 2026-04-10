"use client"

import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnersGrid } from "@/components/winners-grid"
import { ShieldCheck, ExternalLink, Ticket, Zap } from "lucide-react"

interface LiveGiveaway {
  slug: string
  title: string
  heroImageUrl: string | null
  ticketPricePence: number
  endsAt: string
}

interface WinnersPageClientProps {
  winners: WinnerSnapshot[]
  liveGiveaway?: LiveGiveaway | null
}

export function WinnersPageClient({ winners, liveGiveaway }: WinnersPageClientProps) {
  return (
    <>
      {/* Premium Hero Banner */}
      <div className="relative mb-6 overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-br from-[#2a0845] via-[#1f0033] to-[#0f0018] p-4 shadow-[0_0_40px_rgba(139,92,246,0.15)] md:p-5">
        {/* Glow accents */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl" />
        
        <div className="relative">
          {/* Eyebrow */}
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Live Win Feed</span>
          </div>
          
          {/* Headline */}
          <h1 className="text-xl font-extrabold leading-tight text-white md:text-2xl">
            Thousands of prizes already won
          </h1>
          
          {/* Subcopy */}
          <p className="mt-1.5 text-sm text-white/70 md:text-base">
            See the latest instant wins and jump into the live raffles before the next prize drops.
          </p>
          
          {/* CTA */}
          <Link
            href="/giveaways"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-bold text-black shadow-[0_0_16px_rgba(250,204,21,0.3)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(250,204,21,0.5)] active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Enter Live Raffles
          </Link>
        </div>
      </div>

      {/* Winners Feed - extra bottom padding for sticky CTA + mobile nav */}
      <div className="pb-40 md:pb-12">
        <WinnersGrid winners={winners} liveGiveaway={liveGiveaway} />
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
