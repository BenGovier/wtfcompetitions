"use client"

/**
 * BallTray — the FIVE reusable footballs the customer chooses from for the
 * current shot. Fully keyboard accessible.
 *
 * IMPORTANT interaction model:
 *  - There are always exactly five footballs, regardless of how many tickets
 *    were purchased (1 or 500). They are NOT tickets and carry NO ticket number.
 *  - Choosing a football is PRESENTATION ONLY. It never decides the result —
 *    the outcome comes from the predetermined reveal queue held by the parent.
 *  - The only visible accessibility affordance is an sr-only aria-label
 *    ("Choose ball 1" … "Choose ball 5"); nothing is rendered under the balls.
 */

import { useState } from "react"
import { BALL_SIZE, TIMING } from "./config"
import { Football } from "./FlickableFootball"

interface BallTrayProps {
  /** How many footballs to show. Always five in this prototype. */
  ballCount: number
  /** The ball index currently in play (hidden — it lives on the stage). */
  selectedIndex: number | null
  disabled: boolean
  reducedMotion: boolean
  slowFactor: number
  onSelect: (index: number) => void
}

/** Shallow arc: outer balls sit slightly lower than the centre ball. */
function arcOffset(indexFromCentre: number): number {
  return Math.abs(indexFromCentre) * 7
}

export function BallTray({
  ballCount,
  selectedIndex,
  disabled,
  reducedMotion,
  slowFactor,
  onSelect,
}: BallTrayProps) {
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null)

  const centre = (ballCount - 1) / 2

  const handleSelect = (index: number) => {
    if (disabled || selectingIndex !== null) return
    setSelectingIndex(index)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12)
      } catch {
        /* vibration is best-effort */
      }
    }
    window.setTimeout(() => {
      onSelect(index)
      setSelectingIndex(null)
    }, TIMING.ballLiftMs * slowFactor)
  }

  return (
    <div className="dgf-tray" role="group" aria-label="Choose your ball">
      {Array.from({ length: ballCount }).map((_, i) => {
        const isInPlay = i === selectedIndex
        const isSelecting = i === selectingIndex
        const dimmed = selectingIndex !== null && !isSelecting
        // The in-play ball is hidden from the tray (it is on the stage).
        const hidden = isInPlay
        return (
          <div
            key={i}
            className="dgf-tray-slot"
            style={{
              transform: `translateY(${arcOffset(i - centre)}px)`,
              transitionDuration: `${TIMING.reflowMs * slowFactor}ms`,
              opacity: hidden ? 0 : 1,
              pointerEvents: hidden ? "none" : undefined,
            }}
          >
            <button
              type="button"
              className={`dgf-ball-btn ${isSelecting ? "dgf-ball-selecting" : ""} ${
                dimmed ? "dgf-ball-dim" : ""
              } ${!reducedMotion && !disabled && selectingIndex === null ? "dgf-ball-idle" : ""}`}
              style={{
                width: BALL_SIZE,
                height: BALL_SIZE,
                transitionDuration: `${TIMING.ballLiftMs * slowFactor}ms`,
              }}
              onClick={() => handleSelect(i)}
              disabled={disabled || hidden}
              aria-label={`Choose ball ${i + 1}`}
            >
              <span className="dgf-ball-inner">
                <Football size={BALL_SIZE} idPrefix={`dgf-tray-${i}`} />
              </span>
              {!reducedMotion && isSelecting && <span className="dgf-ball-pulse" aria-hidden="true" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
