"use client"

/**
 * BallTray — the five selectable footballs arranged in a shallow arc with
 * ticket labels. Fully keyboard accessible. Selecting a ball plays THAT
 * ticket's predetermined outcome (the flick never decides the result).
 */

import { useState } from "react"
import type { Ticket } from "./types"
import { BALL_SIZE, BALL_SIZE_SMALL, TIMING } from "./config"
import { Football } from "./FlickableFootball"

interface BallTrayProps {
  tickets: Ticket[]
  /** Ids already played (removed from the tray). */
  playedIds: Set<string>
  /** The id currently in play (hidden — it lives on the stage as the launch ball). */
  inPlayId: string | null
  compact: boolean
  disabled: boolean
  reducedMotion: boolean
  slowFactor: number
  onSelect: (ticket: Ticket) => void
}

/** Shallow arc: outer balls sit slightly lower than the centre ball. */
function arcOffset(indexFromCentre: number): number {
  return Math.abs(indexFromCentre) * 7
}

export function BallTray({
  tickets,
  playedIds,
  inPlayId,
  compact,
  disabled,
  reducedMotion,
  slowFactor,
  onSelect,
}: BallTrayProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const remaining = tickets.filter((t) => !playedIds.has(t.id))
  const size = compact ? BALL_SIZE_SMALL : BALL_SIZE
  const centre = (remaining.length - 1) / 2

  const handleSelect = (ticket: Ticket) => {
    if (disabled || selectingId) return
    setSelectingId(ticket.id)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12)
      } catch {
        /* vibration is best-effort */
      }
    }
    window.setTimeout(() => {
      onSelect(ticket)
      setSelectingId(null)
    }, TIMING.ballLiftMs * slowFactor)
  }

  return (
    <div className="dgf-tray" role="group" aria-label="Choose your ball">
      {remaining.map((ticket, i) => {
        const isInPlay = ticket.id === inPlayId
        const isSelecting = ticket.id === selectingId
        const dimmed = selectingId !== null && !isSelecting
        // The in-play ball is hidden from the tray (it is on the stage).
        const hidden = isInPlay
        return (
          <div
            key={ticket.id}
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
              }`}
              style={{
                width: size,
                height: size,
                transitionDuration: `${TIMING.ballLiftMs * slowFactor}ms`,
              }}
              onClick={() => handleSelect(ticket)}
              disabled={disabled || hidden}
              aria-label={`Shoot with ${ticket.label}`}
            >
              <span className="dgf-ball-inner">
                <Football size={size} idPrefix={`dgf-tray-${ticket.id}`} />
              </span>
              {!reducedMotion && isSelecting && <span className="dgf-ball-pulse" aria-hidden="true" />}
            </button>
            <span className="dgf-ball-label">{compact ? ticket.shortLabel : ticket.label}</span>
          </div>
        )
      })}
    </div>
  )
}
