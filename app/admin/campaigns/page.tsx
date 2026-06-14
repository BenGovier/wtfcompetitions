import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CampaignsTable } from "@/components/admin/campaigns/CampaignsTable"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin/auth"
import type { Campaign } from "@/lib/types/campaign"

type TabKey = 'live' | 'draft' | 'ended' | 'all'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Drafts' },
  { key: 'ended', label: 'Ended' },
  { key: 'all', label: 'All' },
]

function normalizeStatus(raw?: string): TabKey {
  if (raw === 'draft' || raw === 'ended' || raw === 'all') return raw
  return 'live'
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin({ roles: ['admin'] })

  const { status } = await searchParams
  const activeTab = normalizeStatus(status)

  const supabase = await createClient()

  // Single existing query — loads campaigns ordered by newest created first.
  // No entry/order queries and no per-campaign queries are added.
  const { data: rows, error } = await supabase
    .from('campaigns')
    .select(
      'id, status, title, slug, summary, description, start_at, end_at, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, max_tickets_total, max_tickets_per_user'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-destructive">
            {'Failed to load campaigns: ' + error.message}
          </p>
        </div>
      </div>
    )
  }

  const campaigns: Campaign[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    status: r.status ?? 'draft',
    title: r.title ?? '',
    slug: r.slug ?? '',
    summary: r.summary ?? '',
    description: r.description ?? '',
    startAt: r.start_at ?? '',
    endAt: r.end_at ?? '',
    mainPrizeTitle: r.main_prize_title ?? '',
    mainPrizeDescription: r.main_prize_description ?? '',
    heroImageUrl: r.hero_image_url ?? '',
    ticketPricePence: r.ticket_price_pence ?? 0,
    maxTicketsTotal: r.max_tickets_total ?? null,
    maxTicketsPerUser: r.max_tickets_per_user ?? null,
  }))

  // Counts per tab (computed from the single query result — no extra queries).
  const counts: Record<TabKey, number> = {
    live: campaigns.filter((c) => c.status === 'live').length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    ended: campaigns.filter((c) => c.status === 'ended').length,
    all: campaigns.length,
  }

  const toTime = (d: string) => {
    const t = new Date(d).getTime()
    return Number.isFinite(t) ? t : 0
  }

  // Filter by active tab, then sort per the tab's rule.
  let visible: Campaign[]
  if (activeTab === 'live') {
    // Live: newest/live campaigns first (by start date desc).
    visible = campaigns
      .filter((c) => c.status === 'live')
      .sort((a, b) => toTime(b.startAt) - toTime(a.startAt))
  } else if (activeTab === 'draft') {
    // Drafts: newest created first (query already returns created_at desc).
    visible = campaigns.filter((c) => c.status === 'draft')
  } else if (activeTab === 'ended') {
    // Ended: most recently ended first (by end date desc).
    visible = campaigns
      .filter((c) => c.status === 'ended')
      .sort((a, b) => toTime(b.endAt) - toTime(a.endAt))
  } else {
    // All: newest created first (query order preserved).
    visible = campaigns
  }

  const emptyLabel =
    activeTab === 'live'
      ? 'No live campaigns'
      : activeTab === 'draft'
        ? 'No draft campaigns'
        : activeTab === 'ended'
          ? 'No ended campaigns'
          : 'No campaigns'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
        <Button asChild>
          <Link href="/admin/campaigns/new">Create Campaign</Link>
        </Button>
      </div>

      <nav
        aria-label="Filter campaigns by status"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={`/admin/campaigns?status=${tab.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={
                'inline-flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
                (isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {tab.label}
              <span
                className={
                  'rounded-full px-1.5 py-0.5 text-xs ' +
                  (isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground')
                }
              >
                {counts[tab.key]}
              </span>
            </Link>
          )
        })}
      </nav>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <CampaignsTable campaigns={visible} />
      )}
    </div>
  )
}
