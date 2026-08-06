"use client"

/**
 * DgCharacter — the two central character photos (neutral + mouth-open) sharing
 * one identical absolute frame. They cross-fade with no change of scale or
 * position. If either asset is missing, a clear development-only warning is
 * shown naming the file — we never silently substitute another person/graphic.
 */

import { useState } from "react"
import { ASSETS } from "./config"

interface DgCharacterProps {
  mouthOpen: boolean
  reducedMotion: boolean
  slowFactor: number
  /** Brightens the DG shirt logo briefly at impact. */
  logoFlash: boolean
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

export function DgCharacter({ mouthOpen, reducedMotion, slowFactor, logoFlash }: DgCharacterProps) {
  const [neutralError, setNeutralError] = useState(false)
  const [openError, setOpenError] = useState(false)

  const crossfadeMs = 120 * slowFactor
  const breatheStyle = reducedMotion
    ? undefined
    : ({ animationDuration: `${6 * slowFactor}s` } as const)

  return (
    <div className="dgf-character" aria-hidden="true">
      {/* Green rim light behind the shoulders */}
      <div className="dgf-rim" />

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

        {/* Shirt logo flash accent (kept subtle, sits low-centre on the chest) */}
        <div className={`dgf-shirt-logo ${logoFlash ? "dgf-shirt-logo-flash" : ""}`}>DG</div>
      </div>
    </div>
  )
}
