"use client"

/**
 * TrajectoryGuide — a luminous curved power trajectory from the ball toward
 * DG's mouth. Presentation only. Rendered in stage-local coordinates.
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

export function TrajectoryGuide({
  width,
  height,
  from,
  control,
  to,
  charge,
  reducedMotion,
}: TrajectoryGuideProps) {
  if (width <= 0 || height <= 0) return null

  const path = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`
  const intensity = 0.35 + charge * 0.65

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="dgf-trajectory"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dgf-traj-core" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(168,255,25,0)" />
          <stop offset="35%" stopColor="rgba(168,255,25,0.65)" />
          <stop offset="100%" stopColor="rgba(93,255,0,1)" />
        </linearGradient>
        <filter id="dgf-traj-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>

      {/* Blurred green glow beneath */}
      <path
        d={path}
        fill="none"
        stroke="rgba(168,255,25,0.55)"
        strokeWidth={10 + charge * 8}
        strokeLinecap="round"
        filter="url(#dgf-traj-blur)"
        opacity={intensity}
      />
      {/* Bright central stroke, fading tail via gradient */}
      <path
        d={path}
        fill="none"
        stroke="url(#dgf-traj-core)"
        strokeWidth={2.5 + charge * 2.5}
        strokeLinecap="round"
        opacity={intensity}
      />

      {/* Three moving energy particles along the path */}
      {!reducedMotion &&
        [0, 1, 2].map((i) => (
          <circle key={i} r={2.6 + charge * 1.6} fill="#DFFFA6">
            <animateMotion
              dur={`${1.1 - charge * 0.4}s`}
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
