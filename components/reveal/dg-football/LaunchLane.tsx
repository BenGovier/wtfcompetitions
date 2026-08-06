"use client"

/**
 * LaunchLane — the active game zone between DG and the ball tray.
 *
 * A layered CSS + SVG vertical "power lane" running from the launch point up to
 * DG's mouth: faint perspective pitch markings, two glowing edge lines, drifting
 * green dust, a soft central vertical glow and a subtle circular mouth target.
 * It is quiet before a ball is selected and energises (`active`) afterwards,
 * with energy animating upward toward DG. Presentation only.
 */

import type { CSSProperties } from "react"

interface LaunchLaneProps {
  width: number
  height: number
  /** Stage-local mouth centre (lane top / target). */
  mouth: { x: number; y: number }
  /** Stage-local launch home (lane bottom). */
  home: { x: number; y: number }
  /** True once a ball is selected — brightens the lane and runs upward energy. */
  active: boolean
  /** True while dragging — pushes glow + particle energy further. */
  charging: boolean
  reducedMotion: boolean
}

export function LaunchLane({ width, height, mouth, home, active, charging, reducedMotion }: LaunchLaneProps) {
  if (width <= 0 || height <= 0) return null

  const laneTop = mouth.y + 12
  const laneBottom = home.y + 18
  const laneH = Math.max(0, laneBottom - laneTop)
  // Lane widens toward the viewer (bottom) for a shallow perspective.
  const topHalf = Math.max(26, width * 0.085)
  const botHalf = Math.max(58, width * 0.2)
  const cx = home.x

  const state = active ? (charging ? "dgf-lane-charging" : "dgf-lane-active") : "dgf-lane-idle"

  return (
    <div className={`dgf-lane ${state}`} aria-hidden="true">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="dgf-lane-svg">
        <defs>
          <linearGradient id="dgf-lane-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(168,255,25,0.12)" />
            <stop offset="60%" stopColor="rgba(168,255,25,0.05)" />
            <stop offset="100%" stopColor="rgba(168,255,25,0)" />
          </linearGradient>
          <linearGradient id="dgf-lane-edge" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(168,255,25,0.75)" />
            <stop offset="100%" stopColor="rgba(168,255,25,0)" />
          </linearGradient>
        </defs>

        {/* Perspective floor fill */}
        <polygon
          className="dgf-lane-floor"
          points={`${cx - botHalf},${laneBottom} ${cx + botHalf},${laneBottom} ${cx + topHalf},${laneTop} ${cx - topHalf},${laneTop}`}
          fill="url(#dgf-lane-fill)"
        />

        {/* Faint perspective pitch markings (rungs), denser toward the viewer */}
        <g className="dgf-lane-rungs" stroke="rgba(168,255,25,0.14)" strokeWidth="1">
          {[0.18, 0.36, 0.54, 0.72, 0.9].map((f) => {
            const y = laneBottom - laneH * f
            const half = botHalf + (topHalf - botHalf) * f
            return <line key={f} x1={cx - half} y1={y} x2={cx + half} y2={y} />
          })}
        </g>

        {/* Two glowing edge lines */}
        <line className="dgf-lane-edge-l" x1={cx - botHalf} y1={laneBottom} x2={cx - topHalf} y2={laneTop} stroke="url(#dgf-lane-edge)" strokeWidth="2" strokeLinecap="round" />
        <line className="dgf-lane-edge-r" x1={cx + botHalf} y1={laneBottom} x2={cx + topHalf} y2={laneTop} stroke="url(#dgf-lane-edge)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Soft central vertical glow */}
      <span
        className="dgf-lane-core"
        style={{ left: cx, top: laneTop, height: laneH } as CSSProperties}
      />

      {/* Circular mouth target — a faint glow, never a crosshair */}
      <span className="dgf-lane-target" style={{ left: mouth.x, top: mouth.y } as CSSProperties} />

      {/* Drifting green dust rising toward DG */}
      {!reducedMotion && (
        <div className="dgf-lane-dust">
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className="dgf-lane-mote"
              style={
                {
                  left: cx + (((i * 37) % 100) - 50) * (botHalf / 60),
                  bottom: height - laneBottom,
                  animationDuration: `${2.6 + (i % 4) * 0.6}s`,
                  animationDelay: `${(i % 5) * 0.35}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
