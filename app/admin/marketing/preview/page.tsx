import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { renderMarketingEmail } from '@/lib/marketing/delivery-email'
import { ABANDONED_CHECKOUT_PREVIEW } from '@/lib/marketing/preview-samples'
import { EmailPreviewClient, type EmailPreviewMeta } from '@/components/admin/marketing/EmailPreviewClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin Marketing — Stage 038 EMAIL PREVIEW (admin-only, render-only).
 *
 * Enforces admin authorization, then renders the abandoned-checkout marketing
 * email with the SAME production `renderMarketingEmail` used by live delivery,
 * fed with REPRESENTATIVE, non-personal sample data. It performs NO sending, NO
 * enqueue, NO database writes and exposes NO customer identity — it only hands
 * safe, already-escaped HTML to a sandboxed preview frame.
 */
export default async function AdminMarketingEmailPreviewPage() {
  await requireAdmin({ roles: ['admin'] })

  const sample = ABANDONED_CHECKOUT_PREVIEW
  const rendered = renderMarketingEmail(sample.input)

  // Pull the display metadata straight from the representative sample. These are
  // brand-safe placeholder values, never customer data.
  const template = sample.input.templateSnapshot as {
    subject: string
    previewText: string | null
    heading: string
    ctaLabel: string
  }
  const context = sample.input.contextSnapshot as {
    campaign: { title: string; url: string }
  }

  const meta: EmailPreviewMeta = {
    key: sample.key,
    label: sample.label,
    opportunityType: rendered.opportunityType,
    subject: rendered.subject,
    previewText: template.previewText,
    heading: template.heading,
    campaignTitle: context.campaign.title,
    ctaLabel: template.ctaLabel,
    ctaUrl: context.campaign.url,
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2">
        <Link
          href="/admin/marketing"
          prefetch={false}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to marketing operations
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">Marketing email preview</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Preview of the <span className="font-medium text-foreground">{meta.label}</span> marketing email. This uses
          the live delivery renderer with representative sample data so you can review the exact design before anything
          is ever sent.
        </p>
      </div>

      <EmailPreviewClient html={rendered.html} meta={meta} />
    </div>
  )
}
