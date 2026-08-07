"use client"

/**
 * TargetBoard — the physical five-hole target, recreated from
 * dg-board-reference.png as independent DOM/CSS layers (never the flat image).
 *
 * It renders a premium black-metal frame with bolts and green LED strips, a
 * perforated inner face, and FIVE identical mystery holes in a quincunx:
 *     1     2
 *        3
 *     4     5
 *
 * All five holes look identical before a shot — nothing here exposes which
 * hole wins. The Stage measures each hole's centre from the DOM (via the
 * `.dgf-hole-centre` marker) to aim the flight, so this component only owns the
 * board's appearance and the restrained lighting states:
 *   - `pulse`       sequential anticipation glow (1→2→3→4→5) during flight
 *   - `focusHole`   brighten one hole + deepen its throat as the ball nears
 *   - `enteredHole` the hole the ball has dropped into (throat goes black)
 *   - `resultTone`  colour the focus hole once the result is known
 */

import { HOLES, HOLE_IDS } from "./config"
import type { HoleId } from "./types"

interface TargetBoardProps {
  pulse: boolean
  focusHole: HoleId | null
  enteredHole: HoleId | null
  resultTone: "win" | "nonwin" | null
  reducedMotion: boolean
  showHoleBounds: boolean
  showHoleCentres: boolean
  showBoardBounds: boolean
}

export function TargetBoard({
  pulse,
  focusHole,
  enteredHole,
  resultTone,
  reducedMotion,
  showHoleBounds,
  showHoleCentres,
  showBoardBounds,
}: TargetBoardProps) {
  return (
    <div className={`dgf-board ${showBoardBounds ? "dgf-board-bounds" : ""}`} aria-hidden="true">
      {/* Outer metal frame + corner bolts */}
      <div className="dgf-board-frame">
        <span className="dgf-bolt dgf-bolt-tl" />
        <span className="dgf-bolt dgf-bolt-tr" />
        <span className="dgf-bolt dgf-bolt-bl" />
        <span className="dgf-bolt dgf-bolt-br" />

        {/* Green LED edge strips */}
        <span className="dgf-led dgf-led-left" />
        <span className="dgf-led dgf-led-right" />
        <span className="dgf-led dgf-led-top" />
        <span className="dgf-led dgf-led-bottom" />

        {/* Perforated inner face */}
        <div className="dgf-board-face">
          {HOLE_IDS.map((id) => {
            const pos = HOLES[id]
            const isFocus = focusHole === id
            const isDimmed = focusHole != null && !isFocus
            const isEntered = enteredHole === id
            const toneClass =
              isFocus && resultTone === "win"
                ? "dgf-hole-win"
                : isFocus && resultTone === "nonwin"
                  ? "dgf-hole-nonwin"
                  : ""
            return (
              <div
                key={id}
                className={`dgf-hole ${pulse && !reducedMotion ? "dgf-hole-pulse" : ""} ${
                  isFocus ? "dgf-hole-focus" : ""
                } ${isDimmed ? "dgf-hole-dim" : ""} ${isEntered ? "dgf-hole-entered" : ""} ${toneClass} ${
                  showHoleBounds ? "dgf-hole-bounds" : ""
                }`}
                data-hole={id}
                style={{
                  left: `${pos.xPct * 100}%`,
                  top: `${pos.yPct * 100}%`,
                  ["--dgf-hole-index" as string]: id - 1,
                }}
              >
                {/* Number plaque above the hole */}
                <span className="dgf-hole-plaque">{id}</span>
                {/* Outer secondary glow */}
                <span className="dgf-hole-glow" />
                {/* Recessed throat with inset shadow */}
                <span className="dgf-hole-throat" />
                {/* Thin green illuminated ring + reflective metal lip */}
                <span className="dgf-hole-ring" />
                <span className="dgf-hole-lip" />
                {/* Measurement anchor (invisible unless guide enabled) */}
                <span className={`dgf-hole-centre ${showHoleCentres ? "dgf-hole-centre-on" : ""}`} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Board base / stand */}
      <div className="dgf-board-base" />
    </div>
  )
}
