"use client"

/**
 * DgCharacter — the host personality (Layer: DG), anchored to the LEFT of and
 * partially behind the target board. He is a host element; the BOARD is the
 * main game object, so DG never covers the holes or the ball trajectory.
 *
 * He holds the two supplied, identically-framed photos and cross-fades between
 * them in place (no full-screen takeover):
 *   - dg-neutral.png : initial, choosing, shot-in-flight, non-win, between,
 *                      summary.
 *   - dg-scored.png  : a winning result only — during the celebration and
 *                      behind the winning prize panel.
 * On a win a green/gold burst flashes behind him as he switches to the scored
 * pose. If an asset is missing we show a clear dev notice naming the file,
 * never a substitute person.
 */

import { useState } from "react"
import { ASSETS, TIMING } from "./config"

interface DgCharacterProps {
  /** Which supplied photo to show. */
  pose: "neutral" | "scored"
  /** Green/gold celebration burst behind DG (win only). */
  winFlash: boolean
  /** Dim slightly while a non-win result panel is up (never fully hidden). */
  dim: boolean
  reducedMotion: boolean
  speed: number
  /** Debug: outline the character image frame. */
  showBounds?: boolean
}

export function MissingAssetNotice({ file }: { file: string }) {
  return (
    <div className="dgf-missing" role="status">
      <span className="dgf-missing-badge">DEV: MISSING ASSET</span>
      <code className="dgf-missing-path">{file}</code>
      <span className="dgf-missing-hint">Drop the real DG photo here — no placeholder is shown.</span>
    </div>
  )
}

export function DgCharacter({ pose, winFlash, dim, reducedMotion, speed, showBounds }: DgCharacterProps) {
  const [neutralError, setNeutralError] = useState(false)
  const [scoredError, setScoredError] = useState(false)

  const scored = pose === "scored"
  const crossfadeMs = TIMING.scoredTakeoverMs * speed
  const breatheStyle = reducedMotion ? undefined : ({ animationDuration: `${6 * speed}s` } as const)

  return (
    <div
      className={`dgf-character ${showBounds ? "dgf-character-bounds" : ""} ${dim ? "dgf-character-dim" : ""}`}
      aria-hidden="true"
    >
      {/* Green rim light behind the shoulders */}
      <div className="dgf-rim" />

      {/* Green/gold celebration burst behind DG (win only) */}
      <div className={`dgf-win-flash ${winFlash ? "dgf-win-flash-on" : ""} ${reducedMotion ? "dgf-win-flash-reduced" : ""}`} />

      <div className={`dgf-character-inner ${reducedMotion || scored ? "" : "dgf-breathe"}`} style={breatheStyle}>
        {/* Both images share the exact same frame; only opacity differs. */}
        {neutralError ? (
          <MissingAssetNotice file={ASSETS.dgNeutral} />
        ) : (
          <img
            src={ASSETS.dgNeutral || "/placeholder.svg"}
            alt=""
            className="dgf-dg-img"
            style={{ opacity: scored ? 0 : 1, transitionDuration: `${crossfadeMs}ms` }}
            onError={() => setNeutralError(true)}
            draggable={false}
          />
        )}

        {scoredError ? (
          scored ? <MissingAssetNotice file={ASSETS.dgScored} /> : null
        ) : (
          <img
            src={ASSETS.dgScored || "/placeholder.svg"}
            alt=""
            className={`dgf-dg-img dgf-dg-scored ${scored ? "dgf-dg-scored-in" : ""}`}
            style={{ opacity: scored ? 1 : 0, transitionDuration: `${crossfadeMs}ms` }}
            onError={() => setScoredError(true)}
            draggable={false}
          />
        )}
      </div>
    </div>
  )
}
