'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { AdminInstantWinAward } from '@/lib/types/instantWins'

const PAID_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
]

function formatPence(pence: number | null): string {
  if (pence === null || pence === undefined) return ''
  return (pence / 100).toFixed(2)
}

function parsePounds(pounds: string): number | null {
  const cleaned = pounds.replace(/[£,\s]/g, '')
  if (cleaned === '') return null
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

export default function InstantWinsPage() {
  const [awards, setAwards] = useState<AdminInstantWinAward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [outstandingAmountPence, setOutstandingAmountPence] = useState(0)

  // Filters
  const [paidStatus, setPaidStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [campaignIdInput, setCampaignIdInput] = useState('')
  const [campaignId, setCampaignId] = useState('')

  // Editing state - keyed by award_id
  const [editingPayout, setEditingPayout] = useState<Record<string, string>>({})
  const [savingAward, setSavingAward] = useState<string | null>(null)

  const fetchAwards = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('limit', '25')
    if (paidStatus !== 'all') params.set('paidStatus', paidStatus)
    if (search) params.set('search', search)
    if (campaignId) params.set('campaignId', campaignId)

    try {
      const res = await fetch(`/api/admin/instant-winners?${params.toString()}`)
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || 'Failed to load awards')
        setAwards([])
        setHasNext(false)
        setOutstandingAmountPence(0)
      } else {
        setAwards(json.awards)
        setHasNext(json.hasNext ?? false)
        setOutstandingAmountPence(json.outstandingAmountPence ?? 0)
        // Initialize editing state
        const payoutState: Record<string, string> = {}
        for (const a of json.awards) {
          payoutState[a.award_id] = formatPence(a.payout_amount_pence)
        }
        setEditingPayout(payoutState)
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
      setAwards([])
      setHasNext(false)
      setOutstandingAmountPence(0)
    } finally {
      setLoading(false)
    }
  }, [page, paidStatus, search, campaignId])

  useEffect(() => {
    fetchAwards()
  }, [fetchAwards])

  const handleApplyFilters = () => {
    setSearch(searchInput)
    setCampaignId(campaignIdInput)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyFilters()
    }
  }

  const handleSavePayout = async (awardId: string, newPence: number | null) => {
    setSavingAward(awardId)
    try {
      const res = await fetch('/api/admin/instant-winners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ award_id: awardId, payout_amount_pence: newPence }),
      })
      const json = await res.json()
      if (json.ok) {
        // Update local state
        setAwards((prev) =>
          prev.map((a) =>
            a.award_id === awardId ? { ...a, payout_amount_pence: newPence } : a
          )
        )
        // Refresh outstanding amount
        fetchAwards()
      } else {
        alert(json.error || 'Failed to save')
      }
    } catch (err: any) {
      alert(err.message || 'Network error')
    } finally {
      setSavingAward(null)
    }
  }

  const handleTogglePaid = async (award: AdminInstantWinAward) => {
    const newIsPaid = !award.is_paid
    setSavingAward(award.award_id)
    try {
      const res = await fetch('/api/admin/instant-winners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ award_id: award.award_id, is_paid: newIsPaid }),
      })
      const json = await res.json()
      if (json.ok) {
        // Update local state
        setAwards((prev) =>
          prev.map((a) =>
            a.award_id === award.award_id
              ? {
                  ...a,
                  is_paid: newIsPaid,
                  paid_at: newIsPaid ? new Date().toISOString() : null,
                }
              : a
          )
        )
        // Refresh outstanding amount
        fetchAwards()
      } else {
        alert(json.error || 'Failed to update')
      }
    } catch (err: any) {
      alert(err.message || 'Network error')
    } finally {
      setSavingAward(null)
    }
  }

  const formatTicketRange = (start: number | null, end: number | null) => {
    if (start === null || end === null) return '-'
    if (start === end) return `#${start}`
    return `#${start}-${end}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Instant Winners</h2>
        <p className="text-muted-foreground">
          Track and manage instant win payouts.
        </p>
      </div>

      {/* Outstanding Amount Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Outstanding Unpaid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            £{formatPence(outstandingAmountPence)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Only awards with an entered payout amount count towards this total.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Checkout Ref</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search checkout ref..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="w-[160px]">
          <label className="text-sm font-medium mb-1 block">Campaign ID</label>
          <input
            type="text"
            placeholder="Optional UUID"
            value={campaignIdInput}
            onChange={(e) => setCampaignIdInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="w-[120px]">
          <label className="text-sm font-medium mb-1 block">Paid Status</label>
          <Select
            value={paidStatus}
            onValueChange={(val) => {
              setPaidStatus(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAID_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="secondary" onClick={handleApplyFilters}>
          Apply
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Won At</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Prize</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Checkout Ref</TableHead>
                  <TableHead>Payout (£)</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No instant win awards found.
                    </TableCell>
                  </TableRow>
                ) : (
                  awards.map((award) => {
                    const isSaving = savingAward === award.award_id
                    const payoutValue = editingPayout[award.award_id] ?? ''
                    const currentPence = parsePounds(payoutValue)
                    const hasChanged = currentPence !== award.payout_amount_pence

                    return (
                      <TableRow key={award.award_id} className={award.is_paid ? 'bg-muted/30' : ''}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(award.awarded_at).toLocaleString('en-GB', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate text-sm" title={award.customer_name}>
                          {award.customer_name}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs" title={award.customer_email}>
                          {award.customer_email}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {award.customer_mobile}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-sm" title={award.prize_title}>
                          {award.prize_title}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatTicketRange(award.start_ticket, award.end_ticket)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {award.checkout_ref}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              value={payoutValue}
                              onChange={(e) =>
                                setEditingPayout((prev) => ({
                                  ...prev,
                                  [award.award_id]: e.target.value,
                                }))
                              }
                              placeholder="0.00"
                              className="w-20 h-8 text-sm"
                              disabled={isSaving}
                            />
                            {hasChanged && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleSavePayout(award.award_id, currentPence)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Check className="size-4 text-green-600" />
                                )}
                              </Button>
                            )}
                          </div>
                          {award.payout_amount_pence === null && (
                            <span className="text-xs text-amber-600">Needs amount</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {award.is_paid ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-400">
                              Unpaid
                            </Badge>
                          )}
                          {award.paid_at && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(award.paid_at).toLocaleDateString('en-GB')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={award.is_paid ? 'outline' : 'default'}
                            onClick={() => handleTogglePaid(award)}
                            disabled={isSaving}
                            className="h-8"
                          >
                            {isSaving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : award.is_paid ? (
                              <>
                                <X className="size-3 mr-1" />
                                Unpay
                              </>
                            ) : (
                              <>
                                <Check className="size-3 mr-1" />
                                Mark Paid
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {awards.length} awards (Page {page})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
