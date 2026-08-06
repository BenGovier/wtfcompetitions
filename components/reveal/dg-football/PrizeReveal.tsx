"use client"

/**
 * PrizeReveal — the premium sports-result panel that rises from the bottom,
 * plus the end-of-run SummaryPanel. Not a shadcn Dialog / generic modal.
 * The non-winning result stays upbeat (white + green, never red/"you lose").
 */

import type { CSSProperties } from "react"
import { useEffect, useRef } from "react"
import type { RevealCopy } from "./types"
import { COLORS, formatGBP } from "./config"

/**
 * Focus a button only while its panel is actually visible. Using React's
 * `autoFocus` on an always-mounted, off-screen panel makes the browser scroll
 * the (overflow:hidden) stage to reveal the focused control, which shoved the
 * whole game up by ~448px. A visibility-gated, scroll-suppressed focus avoids
 * that entirely while keeping keyboard users landing on the primary action.
 */
function useVisibleFocus(visible: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!visible) return
    const el = ref.current
    if (!el) return
    const id = window.setTimeout(() => {
      try {
        el.focus({ preventScroll: true })
      } catch {
        el.focus()
      }
    }, 40)
    return () => window.clearTimeout(id)
  }, [visible])
  return ref
}

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
  /** 1-based index of the ticket just revealed, and the run total. */
  shotIndex: number
  shotTotal: number
  /** Label of the NEXT shot (only meaningful when !isLast). */
  shotLabel: string
  onNext: () => void
}

export function PrizeReveal({
  copy,
  visible,
  reducedMotion,
  slowFactor,
  isLast,
  shotIndex,
  shotTotal,
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

  const btnRef = useVisibleFocus(visible)

  return (
    <div
      className={`dgf-panel dgf-panel-${copy.tone} ${visible ? "dgf-panel-in" : ""} ${
        reducedMotion ? "dgf-panel-reduced" : ""
      }`}
      style={{ transitionDuration: `${820 * slowFactor}ms` }}
      role="dialog"
      aria-modal="false"
      aria-label={`${copy.eyebrow} ${copy.amount} ${copy.unit}`.trim()}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="dgf-panel-edge" />
      {visible && !reducedMotion && <Confetti tone={copy.tone} slowFactor={slowFactor} />}

      <div className="dgf-panel-body">
        {copy.tone === "big" && <div className="dgf-rays" aria-hidden="true" />}

        <p className={`dgf-panel-eyebrow ${isWin ? "dgf-eyebrow-win" : "dgf-eyebrow-none"}`}>
          {copy.eyebrow}
        </p>

        {copy.isMoney ? (
          <p
            className={`dgf-panel-amount ${visible ? "dgf-value-pop" : ""}`}
            style={{ color: valueColor }}
            aria-live="assertive"
          >
            <span className="dgf-panel-amount-value">{copy.amount}</span>
            {copy.unit && <span className="dgf-panel-amount-unit">{copy.unit}</span>}
          </p>
        ) : (
          <p
            className={`dgf-panel-headline text-balance ${visible ? "dgf-value-pop" : ""}`}
            style={{ color: valueColor }}
            aria-live="assertive"
          >
            {copy.amount}
          </p>
        )}

        <p className="dgf-panel-support text-balance">{copy.support}</p>

        {/*
          If more reveals remain, point the customer at the shot they are ABOUT
          to open (shotLabel = the NEXT shot). On the final reveal there is no
          next shot — go straight to the final result.
        */}
        <button ref={btnRef} type="button" className="dgf-next-btn" onClick={onNext}>
          {isLast ? "SEE FINAL RESULT" : "NEXT SHOT"}
          {!isLast && <span className="dgf-next-sub">{shotLabel}</span>}
        </button>

        <p className="dgf-panel-progress" aria-hidden="true">
          {shotIndex} / {shotTotal} TICKETS PLAYED
        </p>
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
  const btnRef = useVisibleFocus(visible)
  return (
    <div
      className={`dgf-panel dgf-summary ${visible ? "dgf-panel-in" : ""} ${
        reducedMotion ? "dgf-panel-reduced" : ""
      }`}
      style={{ transitionDuration: `${520 * slowFactor}ms` }}
      role="dialog"
      aria-modal="false"
      aria-label="All shots complete"
      aria-hidden={!visible}
      inert={!visible}
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

        <button ref={btnRef} type="button" className="dgf-next-btn" onClick={onFinish}>
          FINISH
        </button>
      </div>
    </div>
  )
}
