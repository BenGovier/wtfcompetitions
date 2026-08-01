"use client"

// TEMPORARY verification harness — deleted after screenshotting.
import { TreasureChestReveal } from "@/components/checkout/reveal/TreasureChestReveal"

export default function DevTreasurePreview() {
  return (
    <TreasureChestReveal
      award={{
        confirmed: true,
        checkout_ref: "ref_dev",
        qty: 3,
        won: true,
        prize: { title: "Cash Prize", value_text: "£500" },
        prizes: [{ title: "Cash Prize", value_text: "£500" }],
        ticket_start: 1041,
        ticket_end: 1043,
        campaign_slug: "demo",
      }}
    />
  )
}
