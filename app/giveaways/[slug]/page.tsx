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
export const dynamic = 'force-dynamic'

interface GiveawayPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function GiveawayPage({ params }: GiveawayPageProps) {
  const { slug } = await params
  const supabase = createPublicClient()

  // 1) Try detail snapshot
  const { data: detailData, error: detailErr } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .eq('kind', 'detail')
    .contains('payload', { slug })
    .order('generated_at', { ascending: false })
    .limit(1)

  if (detailErr) {
    console.error('[giveaways/[slug]] detail fetch failed', {
      slug,
      message: detailErr.message,
      code: (detailErr as any).code,
    })
  }

  const detailRow = detailData?.[0] ?? null

  // 2) Fallback to list snapshot if no detail
  let listRow: typeof detailRow = null
  if (!detailRow) {
    const { data: listData, error: listErr } = await supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .contains('payload', { slug })
      .order('generated_at', { ascending: false })
      .limit(1)

    if (listErr) {
      console.error('[giveaways/[slug]] list fetch failed', {
        slug,
        message: listErr.message,
        code: (listErr as any).code,
      })
    }

    listRow = listData?.[0] ?? null
  }

  const row = detailRow || listRow

  if (!row) {
    console.error('[giveaways/[slug]] snapshot missing', { slug, detailFound: !!detailRow, listFound: !!listRow })
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

  // Resolve giveaway_id for ticket counter (FK references giveaways table, not campaigns)
  const capTotal: number | null = p.hard_cap_total_tickets ?? null
  let soldCount = 0
  {
    const { data: giveaway } = await supabase
      .from('giveaways')
      .select('id')
      .eq('campaign_id', campaignId)
      .limit(1)
      .maybeSingle()

    if (giveaway) {
      const { data: counter } = await supabase
        .from('giveaway_ticket_counters')
        .select('next_ticket')
        .eq('giveaway_id', giveaway.id)
        .limit(1)
        .maybeSingle()
      soldCount = Math.max(0, (counter?.next_ticket ?? 1) - 1)
    }
  }

  const instantWins = Array.isArray(p.instant_wins) ? p.instant_wins : []
  const bundles = p.bundles || undefined
  const rulesText = p.rules_text || 'See full terms and conditions for complete rules.'
  const faqSnippet = p.faq_snippet || null
  const socialProof = p.social_proof || null

  const displayImages = images
  const isLive = status === "live"

  return (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#3a0f4f_0%,_#1b0b2b_40%,_#0e0618_100%)] pb-24 text-white md:pb-8">
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
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Live Now
                    </Badge>
                  )}
                </div>
                <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight drop-shadow-[0_0_15px_rgba(255,0,200,0.4)] md:text-5xl">{title}</h1>
                <p className="mt-2 text-pretty text-lg text-purple-300">
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
                <TicketSelector basePrice={ticketPrice} bundles={bundles} campaignId={campaignId} soldCount={soldCount} capTotal={capTotal} startsAt={p.starts_at ?? null} endsAt={p.ends_at ?? null} ticketsSold={Number(p.tickets_sold ?? 0)} hardCapTotalTickets={Number(p.hard_cap_total_tickets ?? 0)} />
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

      {/* Mobile Sticky CTA — hidden server-side when draw has ended */}
      {!(p.ends_at && new Date(p.ends_at).getTime() <= Date.now()) && (
        <div className="fixed bottom-16 left-0 right-0 border-t border-purple-500/30 bg-[#0e0618]/95 p-4 shadow-[0_-4px_30px_rgba(168,85,247,0.2)] backdrop-blur-lg md:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-purple-300">Entry from</div>
              <div className="text-xl font-bold text-[#FFD46A]">£{ticketPrice.toFixed(2)}</div>
            </div>
            <Link
              href="#ticket-selector"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] px-8 text-sm font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:shadow-[0_15px_60px_rgba(255,180,0,0.6)]"
            >
              Enter Now
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
