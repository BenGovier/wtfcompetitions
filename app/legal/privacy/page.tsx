import { SectionHeader } from "@/components/section-header"

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Privacy Policy" />

      <div className="prose prose-gray mt-8 dark:prose-invert">
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide when creating an account and entering giveaways.</p>

        <h2>2. How We Use Your Information</h2>
        <p>Your information is used to manage your account, process entries, and contact winners.</p>

        <h2>3. Placeholder Content</h2>
        <p>This is placeholder content. Full privacy policy will be added when the platform goes live.</p>
      </div>
    </div>
  )
}
