"use client"

import { useState } from "react"
import Link from "next/link"
import { SectionHeader } from "@/components/section-header"
import { AvatarPicker } from "@/components/avatar-picker"
import { VisibilityToggleCard } from "@/components/visibility-toggle-card"
import { SaveBar } from "@/components/save-bar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Profile } from "@/lib/types"

// Mock initial profile data
const mockProfile: Profile = {
  name: "Alex Johnson",
  email: "alex.johnson@example.com",
  avatarUrl: "/professional-portrait.png",
  bio: "Love entering giveaways and trying new products!",
  publicVisible: true,
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(mockProfile)
  const [saveState, setSaveState] = useState<{
    loading: boolean
    success: boolean
    error?: string
  }>({
    loading: false,
    success: false,
  })

  const handleSave = async () => {
    setSaveState({ loading: true, success: false })

    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock success
    setSaveState({ loading: false, success: true })

    // Reset success state after 3 seconds
    setTimeout(() => {
      setSaveState((prev) => ({ ...prev, success: false }))
    }, 3000)

    // TODO: Replace with real API call
  }

  const hasName = profile.name.trim().length > 0
  const hasAvatar = Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0)
  const isValid = hasName && hasAvatar

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <SectionHeader
            title="Your Profile"
            subtitle="Your name and photo/avatar are shown when you win. You can control your public visibility below."
          />
        </div>

        {/* Profile Photo / Avatar */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Profile Photo</h3>
          <AvatarPicker
            avatarUrl={profile.avatarUrl}
            name={profile.name || "User"}
            onChange={(url) => setProfile({ ...profile, avatarUrl: url })}
          />
        </section>

        {/* Identity Fields */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold">Identity</h3>

          <div className="space-y-2">
            <Label htmlFor="name" className="required">
              Real name
            </Label>
            <Input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Enter your full name"
              required
              aria-required="true"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">Your real name is required and will be shown if you win.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="max-w-md bg-muted"
              aria-readonly="true"
            />
            <p className="text-xs text-muted-foreground">Your email address cannot be changed here.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Short bio (optional)</Label>
            <Textarea
              id="bio"
              value={profile.bio || ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell us a bit about yourself..."
              rows={3}
              maxLength={200}
              className="max-w-md resize-none"
            />
            <p className="text-xs text-muted-foreground">{profile.bio?.length || 0}/200 characters</p>
          </div>
        </section>

        {/* Public Visibility Toggle */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Public Visibility</h3>
          <VisibilityToggleCard
            publicVisible={profile.publicVisible}
            onChange={(visible) => setProfile({ ...profile, publicVisible: visible })}
          />
        </section>

        {/* Save Section */}
        <section className="space-y-4 border-t pt-6">
          <SaveBar
            onSave={handleSave}
            disabled={!isValid}
            loading={saveState.loading}
            success={saveState.success}
            error={saveState.error}
          />
        </section>

        {/* Safety / Trust Notes */}
        <section className="rounded-lg border bg-muted/50 p-6">
          <h4 className="font-semibold">Privacy & Data Use</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            We use your profile information to verify winners and display them publicly (unless you opt out). You can
            update your visibility preferences at any time.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/legal/privacy" className="text-primary hover:underline">
              Read our Privacy Policy
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}
