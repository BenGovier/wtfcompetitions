"use client"

/**
 * ImpactSequence — the burst at the moment the ball reaches DG's mouth.
 * A green radial flash (not a full white screen flash), an expanding
 * shockwave ring and a short green/white particle spray. Screen shake is
 * applied by the Stage to its own wrapper.
 */

import type { CSSProperties } from "react"

interface ImpactSequenceProps {
  active: boolean
  reducedMotion: boolean
  slowFactor: number
  /** Stage-local centre of the mouth target. */
  center: { x: number; y: number }
}

const PARTICLES = 14

export function ImpactSequence({ active, reducedMotion, slowFactor, center }: ImpactSequenceProps) {
  if (!active) return null

  const flashDur = 450 * slowFactor

  return (
    <div className="dgf-impact" aria-hidden="true" style={{ left: center.x, top: center.y }}>
      {/* Green radial flash */}
      <span
        className="dgf-impact-flash"
        style={{ animationDuration: `${flashDur}ms` } as CSSProperties}
      />
      {/* Expanding shockwave ring */}
      <span
        className="dgf-impact-ring"
        style={{ animationDuration: `${flashDur}ms` } as CSSProperties}
      />

      {/* Particle spray (skipped under reduced motion) */}
      {!reducedMotion &&
        Array.from({ length: PARTICLES }).map((_, i) => {
          const angle = (i / PARTICLES) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2)
          const dist = 60 + (i % 4) * 22
          const dx = Math.cos(angle) * dist
          const dy = Math.sin(angle) * dist
          const isGreen = i % 3 !== 0
          return (
            <span
              key={i}
              className="dgf-impact-spark"
              style={
                {
                  "--dgf-dx": `${dx}px`,
                  "--dgf-dy": `${dy}px`,
                  background: isGreen ? "#A8FF19" : "#F7F7F2",
                  animationDuration: `${(420 + (i % 5) * 40) * slowFactor}ms`,
                } as CSSProperties
              }
            />
          )
        })}
    </div>
  )
}
