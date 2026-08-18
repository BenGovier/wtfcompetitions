import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { renderMarketingEmail } from '@/lib/marketing/delivery-email'
import { MARKETING_PREVIEW_SAMPLES } from '@/lib/marketing/preview-samples'
import {
  EmailPreviewClient,
  type EmailPreviewItem,
} from '@/components/admin/marketing/EmailPreviewClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin Marketing — Stage 039 EMAIL PREVIEW (admin-only, render-only).
 *
 * Enforces admin authorization, then renders EVERY marketing automation's email
 * with the SAME production `renderMarketingEmail` used by live delivery, fed
 * with REPRESENTATIVE, non-personal sample data. It performs NO sending, NO
 * enqueue, NO database writes and exposes NO customer identity — it only hands
 * safe, already-escaped HTML to a sandboxed preview frame per automation.
 */
export default async function AdminMarketingEmailPreviewPage() {
  await requireAdmin({ roles: ['admin'] })

  // Render each representative sample through the real delivery renderer. If any
  // sample failed to render it would throw here (fail closed), so a rendered
  // preview is proof the snapshot contract holds for that automation.
  const items: EmailPreviewItem[] = MARKETING_PREVIEW_SAMPLES.map((sample) => {
    const rendered = renderMarketingEmail(sample.input)
    return { html: rendered.html, meta: sample.meta }
  })

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
          Preview of the marketing email for every automation. Each uses the live delivery renderer with
          representative sample data, so you can review the exact design before anything is ever sent.
        </p>
      </div>

      <EmailPreviewClient items={items} />
    </div>
  )
}
