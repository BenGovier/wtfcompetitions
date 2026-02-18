import { notFound } from "next/navigation"
import Link from "next/link"
import { createPublicClient } from "@/lib/supabase/public"
import { CountdownBadge } from "@/components/countdown-badge"
import { TicketSelector } from "@/components/ticket-selector"
import { SocialProofRow } from "@/components/social-proof-row"
import { RulesAccordion } from "@/components/rules-accordion"
import { InstantWinDisclosure } from "@/components/instant-win-disclosure"
import { TrustBadges } from "@/components/trust-badges"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield, Award, ChevronRight } from "lucide-react"

export const revalidate = 60

interface GiveawayPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function GiveawayPage({ params }: GiveawayPageProps) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .eq('kind', 'detail')
    .filter('payload->>slug', 'eq', slug)
    .order('generated_at', { ascending: false })
    .limit(1)

  const row = data?.[0] ?? null

  if (error || !row) {
    notFound()
  }

  const p = row.payload as Record<string, any>

  const title = p.title || 'Untitled'
  const prizeTitle = p.prize_title || p.title || 'Prize'
  const prizeValueText = p.prize_value_text || null
  const heroImageUrl = p.hero_image_url || '/placeholder.svg'
  const images: string[] = p.images || [heroImageUrl]
  const status = p.status as "draft" | "live" | "paused" | "ended"
  const endsAt = new Date(p.ends_at)
  const ticketPrice = (p.base_ticket_price_pence ?? 0) / 100
  const giveawayId = (p.giveaway_id as string) || (p.id as string)
  const campaignId = (p.campaign_id as string) || (p.campaignId as string)

  if (!giveawayId || !campaignId) {
    notFound()
  }

  const bundles = p.bundles || undefined
  const rulesText = p.rules_text || 'See full terms and conditions for complete rules.'
  const faqSnippet = p.faq_snippet || null
  const socialProof = p.social_proof || null

  const displayImages = images
  const isLive = status === "live"

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Prize Hero Section */}
      <section className="border-b bg-muted/30">
        <div className="container max-w-5xl px-4 py-8">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Prize Image */}
            <div className="space-y-4">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-white">
                <img
                  src={displayImages[0] || "/placeholder.svg"}
                  alt={prizeTitle}
                  className="h-full w-full object-contain"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              {displayImages.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {displayImages.slice(1, 4).map((img, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-md border bg-white">
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
                <h1 className="text-balance text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
                <p className="mt-2 text-pretty text-lg text-muted-foreground">{prizeTitle}</p>
                {prizeValueText && (
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">Retail Value:</span>
                    <span className="text-2xl font-bold text-brand">{prizeValueText}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div id="ticket-selector" className="scroll-mt-24">
                <TicketSelector basePrice={ticketPrice} bundles={bundles} campaignId={campaignId} giveawayId={giveawayId} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container max-w-5xl px-4 py-8">
        <div className="space-y-8">
          {/* Instant Win Disclosure */}
          <InstantWinDisclosure />

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
              <div className="flex gap-3 rounded-lg border bg-card p-4">
                <Shield className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Secure & Verified</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    All payments processed through secure, encrypted channels. Your information is protected.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border bg-card p-4">
                <Award className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Transparent Winners</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
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
            <section className="rounded-lg border bg-muted/30 p-6">
              <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
              <p className="mt-2 text-sm text-muted-foreground">{faqSnippet}</p>
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

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 border-t bg-background p-4 shadow-lg md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Entry from</div>
            <div className="text-xl font-bold text-brand">£{ticketPrice.toFixed(2)}</div>
          </div>
          <Link
            href="#ticket-selector"
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-8 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
          >
            Enter Now
          </Link>
        </div>
      </div>
    </div>
  )
}
