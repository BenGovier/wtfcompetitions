// TEMP: Emergency hotfix - removed all Supabase/async calls for instant load
// Revert this file once DB stability is confirmed

import Link from "next/link"
import { Clock, Ticket } from "lucide-react"

// TEMP: Static fallback data - replace with DB fetch when stable
const emergencyGiveaways = [
  {
    id: 'emergency-1',
    title: 'Super Holiday',
    subtitle: 'Enter now for your chance to win our live Super Holiday giveaway.',
    href: '/giveaways/superholiday',
    status: 'Live now',
  },
  {
    id: 'emergency-2',
    title: 'More Prizes Coming Soon',
    subtitle: 'We are experiencing very high demand. Thank you for your patience.',
    href: '/giveaways/superholiday',
    status: 'Available',
  },
]

export default function GiveawaysPage() {
  // TEMP: Removed async/await and all Supabase calls for instant page load

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8">
        <div>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-white md:text-3xl">All Giveaways</h2>
          <p className="mt-1 text-pretty bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Browse all active giveaways and enter to win</p>
        </div>

        {/* TEMP: Static fallback cards - replace with GiveawayCard + DB data when stable */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {emergencyGiveaways.map((giveaway) => (
            <Link
              key={giveaway.id}
              href={giveaway.href}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-yellow-500/30 hover:bg-white/10"
            >
              {/* Status badge */}
              <div className="absolute right-4 top-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  {giveaway.status}
                </span>
              </div>

              {/* Content */}
              <div className="mt-8">
                <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors">
                  {giveaway.title}
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  {giveaway.subtitle}
                </p>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center gap-4 text-sm text-white/60">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Limited time</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Ticket className="h-4 w-4" />
                  <span>Tickets available</span>
                </div>
              </div>

              {/* Hover gradient */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-yellow-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>

        {/* TEMP: Helpful message during high traffic */}
        <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
          <p className="text-sm text-yellow-200/80">
            Experiencing high traffic. If giveaways aren't loading, please refresh or try again shortly.
          </p>
        </div>
      </div>
    </div>
  )
}
