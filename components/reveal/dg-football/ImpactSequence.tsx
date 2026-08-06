"use client"

/**
 * ImpactSequence — the burst at the moment the ball reaches DG's mouth.
 * Layered at the mouth target:
 *  1. a white core punch (single-frame pop),
 *  2. a green radial flash (not a full-screen white wash),
 *  3. two expanding neon shock-rings,
 *  4. a short green/white debris spray,
 *  5. a lingering neon bloom.
 * Screen shake and camera punch-in are applied by the Stage to its own
 * wrapper; every layer here is non-interactive and CSS-keyframe driven.
 */

import type { CSSProperties } from "react"

interface ImpactSequenceProps {
  active: boolean
  reducedMotion: boolean
  slowFactor: number
  /** Stage-local centre of the mouth target. */
  center: { x: number; y: number }
}

const PARTICLES = 16

export function ImpactSequence({ active, reducedMotion, slowFactor, center }: ImpactSequenceProps) {
  if (!active) return null

  const dur = (ms: number) => `${Math.round(ms * slowFactor)}ms`

  return (
    <div className="dgf-impact" aria-hidden="true" style={{ left: center.x, top: center.y }}>
      {/* White core punch */}
      <span className="dgf-impact-core" style={{ animationDuration: dur(reducedMotion ? 200 : 220) } as CSSProperties} />
      {/* Green radial flash */}
      <span className="dgf-impact-flash" style={{ animationDuration: dur(reducedMotion ? 220 : 420) } as CSSProperties} />

      {!reducedMotion && (
        <>
          {/* Expanding shockwave rings */}
          <span className="dgf-impact-ring" style={{ animationDuration: dur(460) } as CSSProperties} />
          <span className="dgf-impact-ring dgf-impact-ring-2" style={{ animationDuration: dur(580) } as CSSProperties} />
          {/* Lingering bloom */}
          <span className="dgf-impact-bloom" style={{ animationDuration: dur(640) } as CSSProperties} />

          {/* Debris / spark spray */}
          {Array.from({ length: PARTICLES }).map((_, i) => {
            const angle = (i / PARTICLES) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2)
            const dist = 56 + (i % 4) * 24
            const dx = Math.cos(angle) * dist
            const dy = Math.sin(angle) * dist - 6
            const isGreen = i % 3 !== 0
            const size = 4 + (i % 5)
            return (
              <span
                key={i}
                className="dgf-impact-spark"
                style={
                  {
                    width: size,
                    height: size,
                    "--dgf-dx": `${dx}px`,
                    "--dgf-dy": `${dy}px`,
                    background: isGreen ? "#A8FF19" : "#F7F7F2",
                    animationDuration: dur(420 + (i % 5) * 40),
                    animationDelay: dur((i % 4) * 12),
                  } as CSSProperties
                }
              />
            )
          })}
        </>
      )}
    </div>
  )
}
