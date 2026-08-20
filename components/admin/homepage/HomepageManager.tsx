'use client'

import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Plus, X, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  HOMEPAGE_RAILS,
  isManualRail,
  type HomepageRail,
  type MerchandisingItem,
} from '@/lib/admin/homepage-rails'

type RailMeta = { label: string; description: string; manual: boolean }

// Display order + copy for the six rails (matches the brief exactly).
const RAIL_META: Record<HomepageRail, RailMeta> = {
  featured: { label: 'Featured', description: 'Choose which competitions appear in Featured.', manual: true },
  balloon_pop: { label: 'Balloon Pops', description: 'Membership is automatic. Reorder Balloon Pop competitions.', manual: false },
  instant_cash: { label: 'Instant Wins', description: 'Membership is automatic. Reorder Instant Win competitions.', manual: false },
  games: { label: 'Games', description: 'Choose which competitions appear in Games.', manual: true },
  cash: { label: 'Cash', description: 'Choose which competitions appear in Cash.', manual: true },
  luxury: { label: 'Luxury', description: 'Choose which competitions appear in Luxury.', manual: true },
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const CATEGORY_LABELS: Record<string, string> = {
  live_balloon: 'Balloon',
  instant_cash: 'Instant',
  other: 'Other',
}

function formatEndDate(value: string | null): string | null {
  if (!value) return null
  const t = new Date(value)
  if (Number.isNaN(t.getTime())) return null
  return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function idsOf(items: MerchandisingItem[]): string[] {
  return items.map((i) => i.id)
}

export function HomepageManager({
  initialRails,
  eligible,
}: {
  initialRails: Record<HomepageRail, MerchandisingItem[]>
  eligible: MerchandisingItem[]
}) {
  const [rails, setRails] = useState<Record<HomepageRail, MerchandisingItem[]>>(initialRails)
  // Last-saved id order per rail — used to compute the dirty state.
  const [savedIds, setSavedIds] = useState<Record<HomepageRail, string[]>>(() => {
    const out = {} as Record<HomepageRail, string[]>
    for (const rail of HOMEPAGE_RAILS) out[rail] = idsOf(initialRails[rail])
    return out
  })
  const [status, setStatus] = useState<Record<HomepageRail, SaveStatus>>(() => {
    const out = {} as Record<HomepageRail, SaveStatus>
    for (const rail of HOMEPAGE_RAILS) out[rail] = 'idle'
    return out
  })
  const [errors, setErrors] = useState<Record<HomepageRail, string | null>>(() => {
    const out = {} as Record<HomepageRail, string | null>
    for (const rail of HOMEPAGE_RAILS) out[rail] = null
    return out
  })

  const setRail = (rail: HomepageRail, next: MerchandisingItem[]) => {
    setRails((prev) => ({ ...prev, [rail]: next }))
    // Any edit clears a previous "saved" flash and resets error.
    setStatus((prev) => (prev[rail] === 'saved' ? { ...prev, [rail]: 'idle' } : prev))
  }

  const move = (rail: HomepageRail, index: number, delta: number) => {
    const items = rails[rail]
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRail(rail, next)
  }

  const removeItem = (rail: HomepageRail, id: string) => {
    setRail(
      rail,
      rails[rail].filter((i) => i.id !== id),
    )
  }

  const addItem = (rail: HomepageRail, item: MerchandisingItem) => {
    if (rails[rail].some((i) => i.id === item.id)) return
    setRail(rail, [...rails[rail], { ...item, positioned: true }])
  }

  const save = async (rail: HomepageRail) => {
    setStatus((prev) => ({ ...prev, [rail]: 'saving' }))
    setErrors((prev) => ({ ...prev, [rail]: null }))
    const campaignIds = idsOf(rails[rail])
    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rail, campaignIds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Save failed (${res.status})`)
      }
      // Persisted: everything now has a placement row → mark positioned.
      setRails((prev) => ({
        ...prev,
        [rail]: prev[rail].map((i) => ({ ...i, positioned: true })),
      }))
      setSavedIds((prev) => ({ ...prev, [rail]: campaignIds }))
      setStatus((prev) => ({ ...prev, [rail]: 'saved' }))
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [rail]: e?.message ?? 'Save failed' }))
      setStatus((prev) => ({ ...prev, [rail]: 'error' }))
    }
  }

  return (
    <Tabs defaultValue="featured" className="w-full">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        {HOMEPAGE_RAILS.map((rail) => (
          <TabsTrigger key={rail} value={rail} className="gap-2">
            {RAIL_META[rail].label}
            <Badge variant="secondary" className="px-1.5">
              {rails[rail].length}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {HOMEPAGE_RAILS.map((rail) => (
        <TabsContent key={rail} value={rail} className="mt-4">
          <RailPanel
            rail={rail}
            meta={RAIL_META[rail]}
            items={rails[rail]}
            eligible={eligible}
            status={status[rail]}
            error={errors[rail]}
            dirty={idsOf(rails[rail]).join(',') !== savedIds[rail].join(',')}
            onMove={move}
            onRemove={removeItem}
            onAdd={addItem}
            onSave={save}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function RailPanel({
  rail,
  meta,
  items,
  eligible,
  status,
  error,
  dirty,
  onMove,
  onRemove,
  onAdd,
  onSave,
}: {
  rail: HomepageRail
  meta: RailMeta
  items: MerchandisingItem[]
  eligible: MerchandisingItem[]
  status: SaveStatus
  error: string | null
  dirty: boolean
  onMove: (rail: HomepageRail, index: number, delta: number) => void
  onRemove: (rail: HomepageRail, id: string) => void
  onAdd: (rail: HomepageRail, item: MerchandisingItem) => void
  onSave: (rail: HomepageRail) => void
}) {
  const manual = isManualRail(rail)

  return (
    <Card>
      <CardHeader className="gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">{meta.label}</CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusLabel status={status} error={error} dirty={dirty} />
          <Button size="sm" onClick={() => onSave(rail)} disabled={status === 'saving' || !dirty}>
            {status === 'saving' ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-6">
        {manual && (
          <AddCompetition
            eligible={eligible}
            existingIds={items.map((i) => i.id)}
            onAdd={(item) => onAdd(rail, item)}
          />
        )}

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {manual
              ? 'No competitions in this rail yet. Use “Add Competition” to place one.'
              : 'No eligible competitions currently match this rail.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2 pr-3"
              >
                <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>

                <Thumbnail item={item} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title || 'Untitled competition'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {item.slug && <span className="truncate">/{item.slug}</span>}
                    <Badge variant="outline" className="font-normal">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                    {item.presentation_type && (
                      <Badge variant="outline" className="font-normal">
                        {item.presentation_type}
                      </Badge>
                    )}
                    {formatEndDate(item.ends_at) && <span>Ends {formatEndDate(item.ends_at)}</span>}
                    {!manual && !item.positioned && (
                      <Badge variant="secondary" className="font-normal">
                        Auto order
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 bg-transparent"
                    onClick={() => onMove(rail, index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${item.title} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 bg-transparent"
                    onClick={() => onMove(rail, index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${item.title} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  {manual && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(rail, item.id)}
                      aria-label={`Remove ${item.title}`}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SaveStatusLabel({
  status,
  error,
  dirty,
}: {
  status: SaveStatus
  error: string | null
  dirty: boolean
}) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Saving…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircle className="size-4" /> {error ?? 'Error'}
      </span>
    )
  }
  if (status === 'saved' && !dirty) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <Check className="size-4" /> Saved
      </span>
    )
  }
  if (dirty) {
    return <span className="text-sm text-muted-foreground">Unsaved changes</span>
  }
  return null
}

function Thumbnail({ item }: { item: MerchandisingItem }) {
  if (!item.hero_image_url) {
    return <div className="size-10 shrink-0 rounded-md bg-muted" aria-hidden="true" />
  }
  return (
    // Plain img with lazy loading — no priority/preload for an admin list.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.hero_image_url || '/placeholder.svg'}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      className="size-10 shrink-0 rounded-md object-cover"
    />
  )
}

function AddCompetition({
  eligible,
  existingIds,
  onAdd,
}: {
  eligible: MerchandisingItem[]
  existingIds: string[]
  onAdd: (item: MerchandisingItem) => void
}) {
  const [open, setOpen] = useState(false)
  const existing = useMemo(() => new Set(existingIds), [existingIds])
  const options = useMemo(
    () => eligible.filter((i) => !existing.has(i.id)),
    [eligible, existing],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent">
          <Plus className="size-4" /> Add Competition
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search live competitions…" />
          <CommandList>
            <CommandEmpty>No eligible competitions found.</CommandEmpty>
            <CommandGroup>
              {options.map((item) => (
                <CommandItem
                  key={item.id}
                  // Include slug so search matches title OR slug.
                  value={`${item.title} ${item.slug ?? ''}`}
                  onSelect={() => {
                    onAdd(item)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.title || 'Untitled competition'}</p>
                    {item.slug && (
                      <p className="truncate text-xs text-muted-foreground">/{item.slug}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="font-normal">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
