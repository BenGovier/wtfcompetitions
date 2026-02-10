import { SectionHeader } from "@/components/section-header"

export default function TermsPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Terms of Service" />

      <div className="prose prose-gray mt-8 dark:prose-invert">
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using WTF Giveaways, you accept and agree to be bound by these Terms of Service.</p>

        <h2>2. Eligibility</h2>
        <p>You must be at least 18 years old to participate in giveaways on our platform.</p>

        <h2>3. Placeholder Content</h2>
        <p>This is placeholder content. Full terms will be added when the platform goes live.</p>
      </div>
    </div>
  )
}
