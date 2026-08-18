'use client'

import { useState } from 'react'

/**
 * TEMPORARY Stage 032 canary control.
 *
 * Visually secondary, clearly labelled temporary. Performs NO work on render:
 * no data fetching, no preflight, no polling, no timers. All Stage 032 checks
 * happen server-side ONLY after the admin explicitly confirms and this makes a
 * single POST to /api/admin/marketing/stage-032-canary. It never auto-retries.
 */

type UiState = 'idle' | 'confirming' | 'running' | 'done' | 'error'

interface SafeResult {
  ok?: boolean
  status?: string
  reason?: string
  claimedCount?: number
  sentCount?: number
  failedCount?: number
  recipient?: string
  error?: string
  check?: string
}

export function Stage032CanaryButton() {
  const [ui, setUi] = useState<UiState>('idle')
  const [result, setResult] = useState<SafeResult | null>(null)

  async function send() {
    setUi('running')
    setResult(null)
    try {
      const res = await fetch('/api/admin/marketing/stage-032-canary', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
      })
      const data: SafeResult = await res.json().catch(() => ({}))
      setResult(data)
      setUi(res.ok && data.ok ? 'done' : 'error')
    } catch {
      setResult({ error: 'request_failed' })
      setUi('error')
    }
  }

  return (
    <section
      aria-labelledby="stage-032-canary-heading"
      className="mt-8 rounded-md border border-dashed border-border bg-muted/40 p-4"
    >
      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        Temporary canary control
      </p>
      <h2 id="stage-032-canary-heading" className="mt-1 text-sm font-medium text-foreground">
        Run Stage 032 Canary
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sends the Stage 032 canary to ben@naay.co.uk only. All safety checks run server-side.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ui === 'idle' || ui === 'done' || ui === 'error' ? (
          <button
            type="button"
            onClick={() => setUi('confirming')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Run Stage 032 Canary
          </button>
        ) : null}

        {ui === 'confirming' ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-foreground">Send the Stage 032 canary to ben@naay.co.uk only?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUi('idle')}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
              >
                Send Canary
              </button>
            </div>
          </div>
        ) : null}

        {ui === 'running' ? (
          <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Running canary...
          </span>
        ) : null}
      </div>

      {result && (ui === 'done' || ui === 'error') ? (
        <pre
          className="mt-3 overflow-x-auto rounded bg-background p-2 text-[11px] text-foreground"
          aria-live="polite"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  )
}
