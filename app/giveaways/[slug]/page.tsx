import { notFound } from "next/navigation"
import Link from "next/link"
import { createPublicClient } from "@/lib/supabase/public"
import { CountdownBadge } from "@/components/countdown-badge"
import { TicketSelector } from "@/components/ticket-selector"
import { SocialProofRow } from "@/components/social-proof-row"
import { RulesAccordion } from "@/components/rules-accordion"
import { InstantWinDisclosure } from "@/components/instant-win-disclosure"
import { InstantWinList } from "@/components/instant-win-list"
import { TrustBadges } from "@/components/trust-badges"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield, Award, ChevronRight } from "lucide-react"
import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount"

export const revalidate = 60

interface GiveawayPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function GiveawayPage({ params }: GiveawayPageProps) {
  const { slug } = await params
  const supabase = createPublicClient()

  // Single indexed query - no JSONB scan
  const { data, error } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .in('kind', ['detail', 'list'])
    .order('generated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[giveaways/[slug]] snapshot fetch failed', {
      slug,
      message: error.message,
      code: (error as any).code,
    })
  }

  // In-memory filter to find matching slug (detail preferred over list due to order)
  const row = data?.find((x) => x.payload?.slug === slug) ?? null

  if (!row) {
    console.error('[giveaways/[slug]] snapshot missing', { slug })
    notFound()
  }

  const p = row.payload as Record<string, any>

  const title = p.title || 'Untitled'
  const prizeTitle = p.prize_title || p.title || 'Prize'
  const description =
    p.prize_description ||
    p.description ||
    p.subtitle ||
    null
  const prizeValueText = p.prize_value_text || null
  const heroImageUrl = p.hero_image_url || '/placeholder.svg'
  const images: string[] = p.images || [heroImageUrl]
  const status = p.status as "draft" | "live" | "paused" | "ended"
  const endsAt = new Date(p.ends_at)
  const ticketPrice = (p.base_ticket_price_pence ?? 0) / 100
  // Snapshot payload `id` is the campaign id in our current snapshot shape
  const campaignId = p.id as string

  if (!campaignId) {
    console.error('[giveaways/[slug]] missing campaignId in snapshot payload', { slug, payloadKeys: Object.keys(p || {}) })
    notFound()
  }

  // Derive soldCount from snapshot payload only (no live DB query)
  const capTotal: number | null = p.hard_cap_total_tickets ?? null
  const soldCount =
    p.tickets_sold != null && !Number.isNaN(Number(p.tickets_sold))
      ? Number(p.tickets_sold)
      : 0

  const instantWins = Array.isArray(p.instant_wins) ? p.instant_wins : []
  const bundles = p.bundles || undefined
  const rulesText = p.rules_text || 'See full terms and conditions for complete rules.'
  const faqSnippet = p.faq_snippet || null
  const socialProof = p.social_proof || null

  const displayImages = images
  const isLive = status === "live"

  return (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#3a0f4f_0%,_#1b0b2b_40%,_#0e0618_100%)] pb-8 text-white">
  <ScrollToTopOnMount />
  {/* Prize Hero Section */}
      <section className="border-b border-purple-500/20">
        <div className="container max-w-5xl px-4 py-8">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Prize Image */}
            <div className="space-y-4">
              <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-2xl ring-1 ring-purple-500/30">
                <img
                  src={displayImages[0] || "/placeholder.svg"}
                  alt={prizeTitle}
                  className="h-full w-full object-contain bg-white/5"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              {displayImages.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {displayImages.slice(1, 4).map((img, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-lg ring-1 ring-purple-500/20">
                      <img
                        src={img || "/placeholder.svg"}
                        alt={`${prizeTitle} view ${i + 2}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prize Details */}
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 pb-3">
                  <CountdownBadge endsAt={endsAt} status={status} />
                  {isLive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_12px_rgba(255,0,0,0.5)]">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      LIVE
                    </span>
                  )}
                </div>
                <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight drop-shadow-[0_0_15px_rgba(255,0,200,0.4)] md:text-5xl">{title}</h1>
                <p className="mt-2 whitespace-pre-line text-pretty text-lg text-purple-300">
                  {description ?? prizeTitle}
                </p>
                {prizeValueText && (
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm text-purple-200">Retail Value:</span>
                    <span className="text-2xl font-bold text-brand">{prizeValueText}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div id="ticket-selector" className="scroll-mt-24">
                <TicketSelector basePrice={ticketPrice} bundles={bundles} campaignId={campaignId} soldCount={soldCount} capTotal={capTotal} startsAt={p.starts_at ?? null} endsAt={p.ends_at ?? null} ticketsSold={p.tickets_sold != null ? Number(p.tickets_sold) : null} hardCapTotalTickets={p.hard_cap_total_tickets != null ? Number(p.hard_cap_total_tickets) : null} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container max-w-5xl px-4 py-8">
        <div className="space-y-8">
          {/* Instant Win Prizes */}
          <InstantWinDisclosure />
          <InstantWinList instantWins={instantWins} />

          {/* Social Proof */}
          {socialProof && (
            <SocialProofRow
              entrantCountBucket={socialProof.entrantCountBucket}
              recentAvatars={socialProof.recentAvatars}
            />
          )}

          {/* Trust & Reassurance */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Why Enter with WTF Giveaways?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-purple-500/20 bg-white/5 p-4 backdrop-blur-sm">
                <Shield className="h-5 w-5 shrink-0 text-pink-400" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Secure & Verified</h3>
                  <p className="text-sm leading-relaxed text-purple-200">
                    All payments processed through secure, encrypted channels. Your information is protected.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-purple-500/20 bg-white/5 p-4 backdrop-blur-sm">
                <Award className="h-5 w-5 shrink-0 text-pink-400" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Transparent Winners</h3>
                  <p className="text-sm leading-relaxed text-purple-200">
                    Fair draws with transparent winner announcements. All winners are publicly verified.
                  </p>
                </div>
              </div>
            </div>
            <TrustBadges />
          </section>

          {/* Rules & Eligibility */}
          <section className="space-y-4">
            <RulesAccordion rulesText={rulesText} />
          </section>

          {/* FAQ Snippet */}
          {faqSnippet && (
            <section className="rounded-lg border border-purple-500/20 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
              <p className="mt-2 text-sm text-purple-200">{faqSnippet}</p>
              <Link
                href="/faq"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                View all FAQs
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          )}
        </div>
      </div>


    </div>
  )
}
