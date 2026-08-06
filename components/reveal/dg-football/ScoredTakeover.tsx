"use client"

/**
 * ScoredTakeover — the winning celebration layer (Layer 6). This is a
 * DELIBERATE cinematic takeover using dg-scored.png, NOT a cross-fade from the
 * mouth-open frame: the pose and framing are intentionally different, so the
 * image punches in over a green/gold energy burst after the ball has entered
 * the mouth and the impact has fired.
 *
 * It covers the central game stage, keeps DG's face, fists and shirt logo
 * readable, and darkens the lower section so the prize panel text stays legible
 * while the celebration image remains visible behind it.
 */

import { ASSETS, TIMING } from "./config"
import { MissingAssetNotice } from "./DgCharacter"
import { useState } from "react"

interface ScoredTakeoverProps {
  /** Mounted for the whole win branch; `entering` drives the punch-in. */
  visible: boolean
  /** True once the takeover should animate in (after the dark transition). */
  entering: boolean
  /** Stronger green/gold burst + extra rays for the top prize. */
  bigWin: boolean
  /** Site-credit win → lighter gold, more green/white. */
  credit: boolean
  reducedMotion: boolean
  slowFactor: number
  /** Debug: outline the scored-image frame + safe area. */
  showBounds?: boolean
}

export function ScoredTakeover({
  visible,
  entering,
  bigWin,
  credit,
  reducedMotion,
  slowFactor,
  showBounds,
}: ScoredTakeoverProps) {
  const [scoredError, setScoredError] = useState(false)
  if (!visible) return null

  const takeoverMs = (TIMING.scoredTakeoverMs + (bigWin ? TIMING.topPrizeExtraMs : 0)) * slowFactor
  const toneClass = bigWin ? "dgf-scored-big" : credit ? "dgf-scored-credit" : "dgf-scored-cash"

  return (
    <div
      className={`dgf-scored ${toneClass} ${entering ? "dgf-scored-in" : ""} ${
        reducedMotion ? "dgf-scored-reduced" : ""
      } ${showBounds ? "dgf-scored-bounds" : ""}`}
      aria-hidden="true"
    >
      {/* Green-and-gold radial energy burst behind the character */}
      <div className="dgf-scored-burst" />
      {bigWin && <div className="dgf-scored-rays" />}
      <div className="dgf-scored-vignette" />

      {/* The celebration takeover image */}
      <div
        className="dgf-scored-frame"
        style={{ transitionDuration: `${takeoverMs}ms`, animationDuration: `${takeoverMs}ms` }}
      >
        {scoredError ? (
          <MissingAssetNotice file={ASSETS.dgScored} />
        ) : (
          <img
            src={ASSETS.dgScored || "/placeholder.svg"}
            alt=""
            className="dgf-scored-img"
            onError={() => setScoredError(true)}
            draggable={false}
          />
        )}
        {/* Gold light sweep across the DG shirt logo */}
        {!reducedMotion && entering && <div className="dgf-scored-logo-sweep" />}
      </div>

      {/* Darken the lower section so prize text stays readable */}
      <div className="dgf-scored-floor" />
    </div>
  )
}
