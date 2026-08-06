"use client"

/**
 * BallTray — the physical set of numbered footballs waiting to be used, laid
 * out in a shallow perspective arc on a dark platform.
 *
 * Interaction model (per the refinement spec):
 *  - One numbered football per remaining TICKET (#1..#N). Each ticket is one
 *    shot; a used football visibly leaves the tray and the rest slide inward.
 *  - Choosing a football is PRESENTATION ONLY — it never decides the result.
 *    The outcome for the current shot is predetermined by the reveal queue.
 *  - While a ball is in play it lives on the stage, so its tray slot collapses.
 */

import { useState } from "react"
import { BALL_SIZE, TIMING } from "./config"
import { Football } from "./FlickableFootball"

interface BallTrayProps {
  /** Remaining ticket ball NUMBERS in tray order (e.g. [2,3,4,5]). */
  numbers: number[]
  /** The number currently in play (on the stage) — its slot collapses. */
  selectedNumber: number | null
  /** The number leaving the tray during the next-shot transition. */
  leavingNumber: number | null
  /** Only choosable while the game is in the choosing phase. */
  disabled: boolean
  reducedMotion: boolean
  slowFactor: number
  onSelect: (n: number) => void
}

/** Shallow arc: outer balls sit slightly lower than the centre ball. */
function arcOffset(indexFromCentre: number): number {
  return Math.abs(indexFromCentre) * 8
}

export function BallTray({
  numbers,
  selectedNumber,
  leavingNumber,
  disabled,
  reducedMotion,
  slowFactor,
  onSelect,
}: BallTrayProps) {
  const [selecting, setSelecting] = useState<number | null>(null)

  const centre = (numbers.length - 1) / 2

  const handleSelect = (n: number) => {
    if (disabled || selecting !== null) return
    setSelecting(n)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12)
      } catch {
        /* best effort */
      }
    }
    window.setTimeout(() => {
      onSelect(n)
      setSelecting(null)
    }, TIMING.ballLiftMs * slowFactor)
  }

  return (
    <div className="dgf-tray-platform">
      <div className="dgf-tray" role="group" aria-label="Choose your ball">
        {numbers.map((n, i) => {
          const isSelecting = n === selecting
          const inPlay = n === selectedNumber
          const leaving = n === leavingNumber
          const dimmed = selecting !== null && !isSelecting
          // Depth cue: outer balls sit lower and blur very slightly.
          const dist = Math.abs(i - centre)
          const outer = dist >= 2
          // A ball on the stage or already leaving collapses its slot so the
          // remaining balls slide smoothly inward.
          const collapsed = (inPlay && !leaving) || leaving

          return (
            <div
              key={n}
              className={`dgf-tray-slot ${collapsed ? "dgf-slot-collapsed" : ""} ${leaving ? "dgf-slot-leaving" : ""}`}
              style={{
                transform: `translateY(${arcOffset(i - centre)}px)`,
                transitionDuration: `${TIMING.reflowMs * slowFactor}ms`,
              }}
            >
              <button
                type="button"
                className={`dgf-ball-btn ${isSelecting ? "dgf-ball-selecting" : ""} ${
                  dimmed ? "dgf-ball-dim" : ""
                } ${outer ? "dgf-ball-outer" : ""} ${
                  !reducedMotion && !disabled && selecting === null ? "dgf-ball-idle" : ""
                }`}
                style={{
                  width: BALL_SIZE,
                  height: BALL_SIZE,
                  transitionDuration: `${TIMING.ballLiftMs * slowFactor}ms`,
                }}
                onClick={() => handleSelect(n)}
                disabled={disabled || inPlay || leaving}
                aria-label={`Choose football number ${n}`}
              >
                <span className="dgf-ball-inner">
                  <Football size={BALL_SIZE} idPrefix={`dgf-tray-${n}`} />
                  <span className="dgf-ball-badge" aria-hidden="true">
                    {n}
                  </span>
                </span>
                {!reducedMotion && isSelecting && <span className="dgf-ball-ring" aria-hidden="true" />}
              </button>
              <span className="dgf-ball-num" aria-hidden="true">
                #{n}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
