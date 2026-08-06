"use client"

/**
 * PrizeReveal — the premium sports-result panel that rises from the bottom,
 * plus the end-of-run SummaryPanel. Not a shadcn Dialog / generic modal.
 * The non-winning result stays upbeat (white + green, never red/"you lose").
 */

import type { CSSProperties } from "react"
import type { RevealCopy } from "./types"
import { COLORS, formatGBP } from "./config"

/* -------------------------------------------------------------------------- */
/*  Confetti (lightweight DOM burst, deterministic)                           */
/* -------------------------------------------------------------------------- */
function Confetti({ tone, slowFactor }: { tone: RevealCopy["tone"]; slowFactor: number }) {
  const count = tone === "big" ? 46 : tone === "none" ? 0 : 22
  if (count === 0) return null
  const palette =
    tone === "big"
      ? [COLORS.gold, COLORS.neon, COLORS.white, COLORS.cash]
      : [COLORS.neon, COLORS.white, COLORS.cash]
  return (
    <div className="dgf-confetti" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 47) % 100
        const delay = (i % 7) * 60
        const dur = 1400 + (i % 6) * 240
        const rot = (i * 57) % 360
        const w = 5 + (i % 3) * 2
        return (
          <span
            key={i}
            className="dgf-confetti-piece"
            style={
              {
                left: `${left}%`,
                width: w,
                height: w * 1.8,
                background: palette[i % palette.length],
                transform: `rotate(${rot}deg)`,
                animationDelay: `${delay}ms`,
                animationDuration: `${dur * slowFactor}ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Single result panel                                                       */
/* -------------------------------------------------------------------------- */
interface PrizeRevealProps {
  copy: RevealCopy
  visible: boolean
  reducedMotion: boolean
  slowFactor: number
  isLast: boolean
  shotLabel: string
  onNext: () => void
}

export function PrizeReveal({
  copy,
  visible,
  reducedMotion,
  slowFactor,
  isLast,
  shotLabel,
  onNext,
}: PrizeRevealProps) {
  const isWin = copy.tone !== "none"
  const valueColor =
    copy.tone === "big" || copy.tone === "cash"
      ? copy.tone === "big"
        ? COLORS.gold
        : COLORS.cash
      : copy.tone === "credit"
        ? COLORS.neon
        : COLORS.white

  return (
    <div
      className={`dgf-panel ${visible ? "dgf-panel-in" : ""} ${reducedMotion ? "dgf-panel-reduced" : ""}`}
      style={{ transitionDuration: `${520 * slowFactor}ms` }}
      role="dialog"
      aria-modal="false"
      aria-label={`${copy.eyebrow} ${copy.value}`}
    >
      <div className="dgf-panel-edge" />
      {visible && !reducedMotion && <Confetti tone={copy.tone} slowFactor={slowFactor} />}

      <div className="dgf-panel-body">
        {copy.tone === "big" && <div className="dgf-rays" aria-hidden="true" />}

        <p className={`dgf-panel-eyebrow ${isWin ? "dgf-eyebrow-win" : "dgf-eyebrow-none"}`}>
          {copy.eyebrow}
        </p>

        <p
          className={`dgf-panel-value ${visible ? "dgf-value-pop" : ""}`}
          style={{ color: valueColor }}
          aria-live="assertive"
        >
          {copy.value}
        </p>

        <p className="dgf-panel-support">{copy.support}</p>

        <button type="button" className="dgf-next-btn" onClick={onNext} autoFocus>
          {isLast ? "SEE RESULTS" : "NEXT SHOT"}
          <span className="dgf-next-sub">{shotLabel}</span>
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  End-of-run summary                                                        */
/* -------------------------------------------------------------------------- */
export interface RunSummary {
  totalShots: number
  instantWins: number
  cashPence: number
  creditPence: number
}

interface SummaryPanelProps {
  summary: RunSummary
  visible: boolean
  reducedMotion: boolean
  slowFactor: number
  onFinish: () => void
}

export function SummaryPanel({ summary, visible, reducedMotion, slowFactor, onFinish }: SummaryPanelProps) {
  const wonSomething = summary.instantWins > 0
  return (
    <div
      className={`dgf-panel dgf-summary ${visible ? "dgf-panel-in" : ""} ${
        reducedMotion ? "dgf-panel-reduced" : ""
      }`}
      style={{ transitionDuration: `${520 * slowFactor}ms` }}
      role="dialog"
      aria-modal="false"
      aria-label="All shots complete"
    >
      <div className="dgf-panel-edge" />
      {visible && wonSomething && !reducedMotion && <Confetti tone="big" slowFactor={slowFactor} />}
      <div className="dgf-panel-body">
        <p className="dgf-panel-eyebrow dgf-eyebrow-win">ALL SHOTS COMPLETE</p>

        <dl className="dgf-summary-grid">
          <div className="dgf-summary-row">
            <dt>Instant wins</dt>
            <dd style={{ color: COLORS.neon }}>{summary.instantWins}</dd>
          </div>
          <div className="dgf-summary-row">
            <dt>Total cash won</dt>
            <dd style={{ color: COLORS.cash }}>{formatGBP(summary.cashPence)}</dd>
          </div>
          <div className="dgf-summary-row">
            <dt>Site credit won</dt>
            <dd style={{ color: COLORS.gold }}>{formatGBP(summary.creditPence)}</dd>
          </div>
        </dl>

        <p className="dgf-panel-support">
          Every ticket is still in the final draw — good luck!
        </p>

        <button type="button" className="dgf-next-btn" onClick={onFinish} autoFocus>
          FINISH
        </button>
      </div>
    </div>
  )
}
