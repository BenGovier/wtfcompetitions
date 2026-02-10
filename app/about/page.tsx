import { SectionHeader } from "@/components/section-header"

export default function AboutPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="About WTF Giveaways" subtitle="Your trusted platform for winning amazing prizes" />

      <div className="prose prose-gray mt-8 dark:prose-invert">
        <p>
          WTF Giveaways is a premium platform where you can enter giveaways for a chance to win incredible prizes, from
          the latest tech to gaming gear and more.
        </p>
        <p>
          We believe in transparency, verified winners, and secure transactions. Every winner is verified and announced
          publicly with their consent.
        </p>
      </div>
    </div>
  )
}
