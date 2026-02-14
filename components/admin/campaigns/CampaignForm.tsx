"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { Campaign } from "@/lib/types/campaign"
import type { InstantWinPrizeRow } from "@/lib/types/instantWins"
import { Trash2, Save, Upload, Plus, Wand2 } from "lucide-react"

interface CampaignFormProps {
  campaign: Campaign
  isNew: boolean
}

export function CampaignForm({ campaign, isNew }: CampaignFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<Campaign>(campaign)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Instant wins state
  const [instantWins, setInstantWins] = useState<InstantWinPrizeRow[]>([])
  const [iwLoading, setIwLoading] = useState(false)
  const [iwError, setIwError] = useState<string | null>(null)
  const [iwSaving, setIwSaving] = useState<Record<string, boolean>>({})
  const [iwUploadingId, setIwUploadingId] = useState<string | null>(null)

  // Ladder generator state
  const [ladderCount, setLadderCount] = useState(5)
  const [ladderStart, setLadderStart] = useState(0.01)
  const [ladderEnd, setLadderEnd] = useState(0.95)

  const campaignId = formData.id || campaign.id

  const handleChange = (
    field: keyof Campaign,
    value: string | number | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Fetch instant wins when campaign has an id
  const fetchInstantWins = useCallback(async () => {
    if (!campaignId) return
    setIwLoading(true)
    setIwError(null)
    try {
      const res = await fetch(`/api/admin/instant-win-prizes?campaignId=${campaignId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to fetch instant wins')
        return
      }
      setInstantWins(json.items || [])
    } catch (err: any) {
      setIwError(err?.message || 'Failed to fetch instant wins')
    } finally {
      setIwLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (campaignId) fetchInstantWins()
  }, [campaignId, fetchInstantWins])

  async function handleUpload() {
    if (!selectedFile) return
    setIsUploading(true)
    setUploadError(null)

    try {
      const supabase = createClient()
      const folder = isNew && !campaign.id ? 'new' : campaign.id
      const safeName = selectedFile.name.toLowerCase().replace(/\s+/g, '-')
      const path = `campaigns/${folder}/${Date.now()}-${safeName}`

      const { error } = await supabase.storage
        .from('campaign-hero')
        .upload(path, selectedFile, { upsert: true, contentType: selectedFile.type })

      if (error) {
        setUploadError(error.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('campaign-hero')
        .getPublicUrl(path)

      handleChange('heroImageUrl', publicUrlData.publicUrl)
      setSelectedFile(null)
      setSaveError(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSave() {
    if (isUploading) {
      setSaveError('Image is still uploading — please wait')
      return
    }
    if (selectedFile && !formData.heroImageUrl) {
      setSaveError('Click Upload to attach the hero image')
      return
    }
    setIsSaving(true)
    setSaveError(null)

    try {
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch('/api/admin/campaigns', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        setSaveError(json.error || `Request failed (${res.status})`)
        return
      }

      if (formData.status === 'ended') {
        try {
          const token = process.env.NEXT_PUBLIC_CRON_SECRET
          await fetch(`/api/jobs/refresh-winner-snapshots${token ? `?token=${token}` : ''}`)
        } catch (e) {
          console.error('[winners] refresh snapshot trigger failed', e)
        }
      }

      router.push('/admin/campaigns')
      router.refresh()
    } catch (err: any) {
      setSaveError(err?.message || 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // --- Instant Win handlers ---

  async function handleAddPrize() {
    if (!campaignId) return
    setIwError(null)
    try {
      const res = await fetch('/api/admin/instant-win-prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          prize_title: 'New Prize',
          unlock_ratio: 0.5,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to add prize')
        return
      }
      setInstantWins((prev) => [...prev, ...(json.items || [])])
    } catch (err: any) {
      setIwError(err?.message || 'Failed to add prize')
    }
  }

  async function handleGenerateLadder() {
    if (!campaignId || ladderCount < 1) return
    setIwError(null)
    const items = []
    for (let i = 0; i < ladderCount; i++) {
      const ratio = ladderCount === 1
        ? ladderStart
        : ladderStart + (ladderEnd - ladderStart) * (i / (ladderCount - 1))
      items.push({
        campaign_id: campaignId,
        prize_title: `Instant Win #${i + 1}`,
        unlock_ratio: Math.round(ratio * 1000) / 1000,
      })
    }

    try {
      const res = await fetch('/api/admin/instant-win-prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to generate ladder')
        return
      }
      setInstantWins((prev) => [...prev, ...(json.items || [])])
    } catch (err: any) {
      setIwError(err?.message || 'Failed to generate ladder')
    }
  }

  function handlePrizeFieldChange(id: string, field: keyof InstantWinPrizeRow, value: string | number | null) {
    setInstantWins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  async function handleSavePrize(prize: InstantWinPrizeRow) {
    const ratio = Number(prize.unlock_ratio)
    if (isNaN(ratio) || ratio < 0 || ratio > 1) {
      setIwError(`Unlock ratio for "${prize.prize_title}" must be between 0 and 1`)
      return
    }

    setIwSaving((prev) => ({ ...prev, [prize.id]: true }))
    setIwError(null)
    try {
      const res = await fetch('/api/admin/instant-win-prizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prize.id,
          campaign_id: prize.campaign_id,
          prize_title: prize.prize_title,
          prize_value_text: prize.prize_value_text,
          unlock_ratio: ratio,
          image_url: prize.image_url,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to save prize')
      }
    } catch (err: any) {
      setIwError(err?.message || 'Failed to save prize')
    } finally {
      setIwSaving((prev) => ({ ...prev, [prize.id]: false }))
    }
  }

  async function handleDeletePrize(prizeId: string) {
    if (!confirm('Delete this instant win prize?')) return
    setIwError(null)
    try {
      const res = await fetch(`/api/admin/instant-win-prizes?id=${prizeId}&campaignId=${campaignId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to delete prize')
        return
      }
      setInstantWins((prev) => prev.filter((p) => p.id !== prizeId))
    } catch (err: any) {
      setIwError(err?.message || 'Failed to delete prize')
    }
  }

  async function handlePrizeImageUpload(prize: InstantWinPrizeRow, file: File) {
    setIwUploadingId(prize.id)
    setIwError(null)
    try {
      const supabase = createClient()
      const safeName = file.name.toLowerCase().replace(/\s+/g, '-')
      const path = `campaigns/${campaignId}/${prize.id}/${Date.now()}-${safeName}`

      const { error } = await supabase.storage
        .from('instant-win-prizes')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (error) {
        setIwError(error.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('instant-win-prizes')
        .getPublicUrl(path)

      const imageUrl = publicUrlData.publicUrl

      // Update local state
      handlePrizeFieldChange(prize.id, 'image_url', imageUrl)

      // Persist to DB
      const res = await fetch('/api/admin/instant-win-prizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prize.id,
          campaign_id: prize.campaign_id,
          image_url: imageUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setIwError(json.error || 'Failed to update image URL')
      }
    } catch (err: any) {
      setIwError(err?.message || 'Image upload failed')
    } finally {
      setIwUploadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Note:</strong> Instant wins are configured separately and are paced throughout the campaign.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="iPhone 15 Pro Giveaway"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => handleChange("slug", e.target.value)}
              placeholder="iphone-15-pro-giveaway"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startAt">Start Date & Time</Label>
            <Input
              id="startAt"
              type="datetime-local"
              value={formData.startAt.slice(0, 16)}
              onChange={(e) => handleChange("startAt", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endAt">End Date & Time</Label>
            <Input
              id="endAt"
              type="datetime-local"
              value={formData.endAt.slice(0, 16)}
              onChange={(e) => handleChange("endAt", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Main prize draw happens at end date
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Main Prize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mainPrizeTitle">Prize Title</Label>
            <Input
              id="mainPrizeTitle"
              value={formData.mainPrizeTitle}
              onChange={(e) => handleChange("mainPrizeTitle", e.target.value)}
              placeholder="iPhone 15 Pro 256GB"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mainPrizeDescription">Prize Description</Label>
            <Textarea
              id="mainPrizeDescription"
              value={formData.mainPrizeDescription}
              onChange={(e) =>
                handleChange("mainPrizeDescription", e.target.value)
              }
              placeholder="Latest model in Titanium Blue"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Input
              id="summary"
              value={formData.summary}
              onChange={(e) => handleChange("summary", e.target.value)}
              placeholder="Short marketing line"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Longer campaign details"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Hero Image</Label>

            {formData.heroImageUrl && (
              <div className="flex items-start gap-3">
                <Image
                  src={formData.heroImageUrl}
                  alt="Hero preview"
                  width={160}
                  height={100}
                  className="rounded-md border object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange('heroImageUrl', '')}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null)
                  setUploadError(null)
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!selectedFile || isUploading}
                onClick={handleUpload}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            {isUploading && (
              <p className="text-xs text-muted-foreground">Uploading image...</p>
            )}
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticketPricePence">Ticket Price (pence)</Label>
            <Input
              id="ticketPricePence"
              type="number"
              value={formData.ticketPricePence}
              onChange={(e) =>
                handleChange("ticketPricePence", Number(e.target.value))
              }
              placeholder="99"
            />
            <p className="text-xs text-muted-foreground">
              Price in pence (e.g., 99 = £0.99)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTicketsTotal">Max Tickets Total (optional)</Label>
            <Input
              id="maxTicketsTotal"
              type="number"
              value={formData.maxTicketsTotal ?? ""}
              onChange={(e) =>
                handleChange(
                  "maxTicketsTotal",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              placeholder="Leave empty for unlimited"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTicketsPerUser">Max Tickets Per User (optional)</Label>
            <Input
              id="maxTicketsPerUser"
              type="number"
              value={formData.maxTicketsPerUser ?? ""}
              onChange={(e) =>
                handleChange(
                  "maxTicketsPerUser",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              placeholder="Leave empty for unlimited"
            />
          </div>
        </CardContent>
      </Card>

      {/* Instant Wins Section */}
      <Card>
        <CardHeader>
          <CardTitle>Instant Wins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Unlock ratio = ticketsSold / maxTicketsTotal threshold. We cap ladder end at 0.95 so prizes
            don&apos;t all release at the very end.
          </p>

          {!campaignId ? (
            <p className="text-sm text-muted-foreground italic">
              Save campaign first to add instant wins.
            </p>
          ) : (
            <>
              {/* Ladder Generator */}
              <div className="rounded-md border p-4 space-y-3">
                <p className="text-sm font-medium">Generate Ladder</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Prizes (N)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-20"
                      value={ladderCount}
                      onChange={(e) => setLadderCount(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Ratio</Label>
                    <Input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      className="w-24"
                      value={ladderStart}
                      onChange={(e) => setLadderStart(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Ratio</Label>
                    <Input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      className="w-24"
                      value={ladderEnd}
                      onChange={(e) => setLadderEnd(Number(e.target.value))}
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleGenerateLadder}>
                    <Wand2 className="mr-1 h-4 w-4" />
                    Generate
                  </Button>
                </div>
              </div>

              {/* Add single */}
              <Button type="button" variant="outline" size="sm" onClick={handleAddPrize}>
                <Plus className="mr-1 h-4 w-4" />
                Add Instant Win
              </Button>

              {iwLoading && <p className="text-sm text-muted-foreground">Loading instant wins...</p>}

              {iwError && <p className="text-sm text-destructive">{iwError}</p>}

              {/* Prize list */}
              {instantWins.length > 0 && (
                <div className="space-y-3">
                  {instantWins.map((prize) => (
                    <div key={prize.id} className="rounded-md border p-3 space-y-3">
                      <div className="flex flex-wrap items-start gap-3">
                        {/* Thumbnail */}
                        {prize.image_url && (
                          <Image
                            src={prize.image_url}
                            alt={prize.prize_title}
                            width={48}
                            height={48}
                            className="rounded border object-cover"
                            unoptimized
                          />
                        )}

                        <div className="flex-1 space-y-2 min-w-[200px]">
                          <div className="flex flex-wrap gap-2">
                            <div className="flex-1 min-w-[150px] space-y-1">
                              <Label className="text-xs">Prize Title</Label>
                              <Input
                                value={prize.prize_title}
                                onChange={(e) =>
                                  handlePrizeFieldChange(prize.id, 'prize_title', e.target.value)
                                }
                                placeholder="Prize title"
                              />
                            </div>
                            <div className="w-32 space-y-1">
                              <Label className="text-xs">Value Text</Label>
                              <Input
                                value={prize.prize_value_text || ''}
                                onChange={(e) =>
                                  handlePrizeFieldChange(prize.id, 'prize_value_text', e.target.value || null)
                                }
                                placeholder="e.g. £50"
                              />
                            </div>
                            <div className="w-28 space-y-1">
                              <Label className="text-xs">Unlock Ratio</Label>
                              <Input
                                type="number"
                                step={0.01}
                                min={0}
                                max={1}
                                value={prize.unlock_ratio}
                                onChange={(e) =>
                                  handlePrizeFieldChange(prize.id, 'unlock_ratio', Number(e.target.value))
                                }
                              />
                            </div>
                          </div>

                          {/* Image upload */}
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              className="max-w-xs text-xs"
                              disabled={iwUploadingId === prize.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handlePrizeImageUpload(prize, file)
                              }}
                            />
                            {iwUploadingId === prize.id && (
                              <span className="text-xs text-muted-foreground">Uploading...</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 pt-5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={!!iwSaving[prize.id]}
                            onClick={() => handleSavePrize(prize)}
                            title="Save prize"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeletePrize(prize.id)}
                            title="Delete prize"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!iwLoading && instantWins.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No instant wins yet. Add one or generate a ladder.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {saveError && (
        <p className="text-sm text-destructive">{saveError}</p>
      )}

      <div className="flex items-center gap-4">
        <Button disabled={isSaving || isUploading} onClick={handleSave}>
          {isSaving ? 'Saving...' : isNew ? 'Create Campaign' : 'Save Changes'}
        </Button>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/campaigns">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
