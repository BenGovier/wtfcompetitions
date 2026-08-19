import { it, vi } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'

vi.mock('server-only', () => ({}))

import { renderMarketingEmail } from '../delivery-email'
import { MARKETING_PREVIEW_SAMPLES } from '../preview-samples'

it('emit six preview HTML files for visual verification', () => {
  mkdirSync('/tmp/agent-browser', { recursive: true })
  for (const sample of MARKETING_PREVIEW_SAMPLES) {
    const out = renderMarketingEmail(sample.input)
    writeFileSync(`/tmp/agent-browser/email-${sample.opportunityType}.html`, out.html, 'utf8')
  }
})
