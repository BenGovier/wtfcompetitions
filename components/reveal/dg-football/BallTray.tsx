"use client"

/**
 * BallTray — the premium bottom platform holding FIVE cosmetic footballs.
 *
 * Interaction model (per the new spec):
 *  - The five footballs are purely COSMETIC choices within each shot. They are
 *    NOT tickets and the choice NEVER decides the result.
 *  - The customer performs ONE interaction: TAP A BALL. On tap we immediately
 *    lock all five, lift/scale/rotate the chosen ball with a halo + energy
 *    ring, dim the rest, then the Stage auto-launches after a short hold.
 *  - The tapped ball reports its on-screen origin so the Stage can fly the real
 *    ball from that exact spot (no duplicate ball is created).
 */

import { useState } from "react"
import { BALL_SIZE, TIMING, TRAY_BALL_COUNT } from "./config"
import { Football } from "./Football"

interface BallTrayProps {
  /** 1-based number of the tapped ball for the current shot, else null. */
  selectedNumber: number | null
  /** Only choosable during the choosing phase. */
  disabled: boolean
  /** Hide the chosen ball once the real flight ball has taken over. */
  hideSelected: boolean
  reducedMotion: boolean
  speed: number
  /** Reports the tapped ball number and its viewport-space centre. */
  onSelect: (n: number, origin: { x: number; y: number }) => void
}

const NUMBERS = Array.from({ length: TRAY_BALL_COUNT }, (_, i) => i + 1)

export function BallTray({
  selectedNumber,
  disabled,
  hideSelected,
  reducedMotion,
  speed,
  onSelect,
}: BallTrayProps) {
  const [selecting, setSelecting] = useState<number | null>(null)

  const handleSelect = (n: number, el: HTMLButtonElement | null) => {
    if (disabled || selecting !== null || selectedNumber !== null) return
    setSelecting(n)
    // Light haptic pulse on tap where supported.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12)
      } catch {
        /* best effort */
      }
    }
    const rect = el?.getBoundingClientRect()
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: 0, y: 0 }
    onSelect(n, origin)
    // Clear the local "selecting" flash once the ball has visibly lifted.
    window.setTimeout(() => setSelecting(null), TIMING.selectHoldMs * speed)
  }

  return (
    <div className="dgf-tray-platform">
      <div className="dgf-tray" role="group" aria-label="Choose a ball">
        {NUMBERS.map((n) => {
          const chosen = n === selectedNumber || n === selecting
          const dimmed = (selectedNumber !== null || selecting !== null) && !chosen
          const hidden = chosen && hideSelected
          return (
            <button
              key={n}
              type="button"
              className={`dgf-ball-btn ${chosen ? "dgf-ball-chosen" : ""} ${
                dimmed ? "dgf-ball-dim" : ""
              } ${hidden ? "dgf-ball-hidden" : ""} ${
                !reducedMotion && !disabled && selectedNumber === null && selecting === null
                  ? "dgf-ball-idle"
                  : ""
              }`}
              style={{
                width: BALL_SIZE,
                height: BALL_SIZE,
                transitionDuration: `${TIMING.ballLiftMs * speed}ms`,
              }}
              onClick={(e) => handleSelect(n, e.currentTarget)}
              disabled={disabled || selectedNumber !== null}
              aria-label={`Choose ball ${n}`}
            >
              <span className="dgf-ball-inner">
                <Football size={BALL_SIZE} idPrefix={`dgf-tray-${n}`} />
                <span className="dgf-ball-badge" aria-hidden="true">
                  {n}
                </span>
              </span>
              {!reducedMotion && chosen && !hidden && <span className="dgf-ball-ring" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
