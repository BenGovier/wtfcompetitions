"use client"

/**
 * DgCharacter — the two supplied character photos (neutral + mouth-open) sharing
 * one identical absolute frame. They cross-fade with no change of scale or
 * position, and the swap is always masked by effects (a rising head glow, a
 * short light sweep across the face and the incoming ball + impact particles),
 * so it never reads as a plain image swap. If an asset is missing we show a
 * clear dev-only notice naming the file — never a substitute person.
 */

import { useState } from "react"
import { ASSETS, TIMING } from "./config"

interface DgCharacterProps {
  /** Show the open-mouth asset (cross-fade target). */
  mouthOpen: boolean
  /** Ramp the green glow behind DG's head (begins ~220ms before impact). */
  headGlow: boolean
  /** Fire a short green light sweep across the face (~170ms before impact). */
  faceSweep: boolean
  /** Keep the shirt-logo / chest area glowing (impact + suspense). */
  chestGlow: boolean
  reducedMotion: boolean
  slowFactor: number
  /** Debug: outline the character image frame. */
  showBounds?: boolean
}

function MissingAssetNotice({ file }: { file: string }) {
  return (
    <div className="dgf-missing" role="status">
      <span className="dgf-missing-badge">DEV: MISSING ASSET</span>
      <code className="dgf-missing-path">{file}</code>
      <span className="dgf-missing-hint">Drop the real DG photo here — no placeholder is shown.</span>
    </div>
  )
}

export function DgCharacter({
  mouthOpen,
  headGlow,
  faceSweep,
  chestGlow,
  reducedMotion,
  slowFactor,
  showBounds,
}: DgCharacterProps) {
  const [neutralError, setNeutralError] = useState(false)
  const [openError, setOpenError] = useState(false)

  const crossfadeMs = TIMING.crossfadeMs * slowFactor
  const breatheStyle = reducedMotion ? undefined : ({ animationDuration: `${6 * slowFactor}s` } as const)

  return (
    <div className={`dgf-character ${showBounds ? "dgf-character-bounds" : ""}`} aria-hidden="true">
      {/* Green rim light behind the shoulders */}
      <div className="dgf-rim" />

      {/* Rising green glow behind the head (pre-impact) */}
      <div className={`dgf-head-glow ${headGlow ? "dgf-head-glow-on" : ""}`} />

      <div className={`dgf-character-inner ${reducedMotion ? "" : "dgf-breathe"}`} style={breatheStyle}>
        {/* Both images share the exact same frame; only opacity differs. */}
        {neutralError ? (
          <MissingAssetNotice file={ASSETS.dgNeutral} />
        ) : (
          <img
            src={ASSETS.dgNeutral || "/placeholder.svg"}
            alt=""
            className="dgf-dg-img"
            style={{ opacity: mouthOpen ? 0 : 1, transitionDuration: `${crossfadeMs}ms` }}
            onError={() => setNeutralError(true)}
            draggable={false}
          />
        )}

        {openError ? (
          mouthOpen ? <MissingAssetNotice file={ASSETS.dgMouthOpen} /> : null
        ) : (
          <img
            src={ASSETS.dgMouthOpen || "/placeholder.svg"}
            alt=""
            className="dgf-dg-img"
            style={{ opacity: mouthOpen ? 1 : 0, transitionDuration: `${crossfadeMs}ms` }}
            onError={() => setOpenError(true)}
            draggable={false}
          />
        )}

        {/* Chest / shirt-logo glow over the real DG logo (impact + suspense) */}
        <div className={`dgf-chest-glow ${chestGlow ? "dgf-chest-glow-on" : ""}`} />

        {/* Short light sweep across the face, masking the expression swap */}
        {!reducedMotion && faceSweep && <div className="dgf-face-sweep" />}
      </div>
    </div>
  )
}
