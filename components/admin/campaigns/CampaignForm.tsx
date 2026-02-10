"use client"

import { useState } from "react"
import Link from "next/link"
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
import type { Campaign } from "@/lib/types/campaign"

interface CampaignFormProps {
  campaign: Campaign
  isNew: boolean
}

export function CampaignForm({ campaign, isNew }: CampaignFormProps) {
  const [formData, setFormData] = useState<Campaign>(campaign)

  const handleChange = (
    field: keyof Campaign,
    value: string | number | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
            <Label htmlFor="heroImageUrl">Hero Image URL</Label>
            <Input
              id="heroImageUrl"
              value={formData.heroImageUrl}
              onChange={(e) => handleChange("heroImageUrl", e.target.value)}
              placeholder="/image.jpg"
            />
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

      <div className="flex items-center gap-4">
        <Button disabled>{isNew ? "Create Campaign" : "Save Changes"}</Button>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/campaigns">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
