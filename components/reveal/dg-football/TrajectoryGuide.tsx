"use client"

/**
 * TrajectoryGuide — a premium sports-game power trajectory from the ball toward
 * DG's mouth. Three stacked layers (wide blurred glow, main energy stroke,
 * bright centre streak), an animated dash offset while aiming, three energy
 * particles running up the path, a fading tail near the ball and a brighter
 * head near DG. Presentation only; the endpoint is always DG's mouth.
 */

interface Point {
  x: number
  y: number
}

interface TrajectoryGuideProps {
  width: number
  height: number
  from: Point
  control: Point
  to: Point
  /** 0..1 charge level — brightens and thickens the guide as the flick grows. */
  charge: number
  reducedMotion: boolean
}

export function TrajectoryGuide({ width, height, from, control, to, charge, reducedMotion }: TrajectoryGuideProps) {
  if (width <= 0 || height <= 0) return null

  const path = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`
  const intensity = 0.4 + charge * 0.6

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="dgf-trajectory" aria-hidden="true">
      <defs>
        <linearGradient id="dgf-traj-core" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(168,255,25,0)" />
          <stop offset="30%" stopColor="rgba(168,255,25,0.5)" />
          <stop offset="100%" stopColor="rgba(223,255,166,1)" />
        </linearGradient>
        <filter id="dgf-traj-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={7} />
        </filter>
      </defs>

      {/* Layer 1 — wide blurred glow */}
      <path
        d={path}
        fill="none"
        stroke="rgba(168,255,25,0.5)"
        strokeWidth={14 + charge * 4}
        strokeLinecap="round"
        filter="url(#dgf-traj-blur)"
        opacity={intensity}
      />
      {/* Layer 2 — main energy stroke (fades toward the ball via gradient) */}
      <path
        d={path}
        fill="none"
        stroke="url(#dgf-traj-core)"
        strokeWidth={5 + charge * 2}
        strokeLinecap="round"
        opacity={intensity}
      />
      {/* Layer 3 — bright centre streak with animated dash while aiming */}
      <path
        d={path}
        fill="none"
        stroke="rgba(240,255,214,0.95)"
        strokeWidth={1.5 + charge}
        strokeLinecap="round"
        strokeDasharray={reducedMotion ? undefined : "10 14"}
        opacity={0.85}
      >
        {!reducedMotion && (
          <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="0.6s" repeatCount="indefinite" />
        )}
      </path>

      {/* Brighter head near DG */}
      <circle cx={to.x} cy={to.y} r={4 + charge * 2} fill="#EFFFD0" opacity={intensity} />

      {/* Three energy particles running up the path (ball → DG) */}
      {!reducedMotion &&
        [0, 1, 2].map((i) => (
          <circle key={i} r={2.6 + charge * 1.6} fill="#DFFFA6">
            <animateMotion
              dur={`${1.05 - charge * 0.4}s`}
              repeatCount="indefinite"
              path={path}
              begin={`${i * 0.33}s`}
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
            />
          </circle>
        ))}
    </svg>
  )
}
