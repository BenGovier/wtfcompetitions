"use client"

/**
 * FlickableFootball — the single active football (launch ball).
 *
 * Pure and presentational: it renders a dimensional black-and-white football
 * and applies whatever transform the Stage computes (drag offset during
 * aiming, or the flight transform during launch). All gesture + physics logic
 * lives in the Stage via useFlickGesture; this component never decides results.
 */

import type { CSSProperties } from "react"
import { forwardRef } from "react"

/* -------------------------------------------------------------------------- */
/*  Reusable football graphic (SVG). Dimensional, not a flat disc.            */
/* -------------------------------------------------------------------------- */
export function Football({ size, idPrefix }: { size: number; idPrefix: string }) {
  const sphere = `${idPrefix}-sphere`
  const shade = `${idPrefix}-shade`
  const gloss = `${idPrefix}-gloss`
  const greenRef = `${idPrefix}-green`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <radialGradient id={sphere} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eef1ec" />
          <stop offset="82%" stopColor="#c7ccc4" />
          <stop offset="100%" stopColor="#9aa197" />
        </radialGradient>
        <radialGradient id={shade} cx="62%" cy="78%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
        <radialGradient id={gloss} cx="34%" cy="26%" r="30%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={greenRef} cx="50%" cy="96%" r="45%">
          <stop offset="0%" stopColor="rgba(168,255,25,0.5)" />
          <stop offset="100%" stopColor="rgba(168,255,25,0)" />
        </radialGradient>
        <clipPath id={`${idPrefix}-clip`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${idPrefix}-clip)`}>
        <circle cx="50" cy="50" r="48" fill={`url(#${sphere})`} />

        {/* Black panels — a classic Telstar arrangement, approximated. */}
        <g fill="#141414">
          {/* central pentagon */}
          <polygon points="50,34 63,44 58,60 42,60 37,44" />
          {/* upper-left partial */}
          <polygon points="20,20 34,26 30,40 16,38 12,26" />
          {/* upper-right partial */}
          <polygon points="80,20 88,30 84,42 70,40 66,26" />
          {/* lower-left partial */}
          <polygon points="14,64 28,60 36,72 28,86 16,82" />
          {/* lower-right partial */}
          <polygon points="86,64 84,82 72,86 64,72 72,60" />
          {/* bottom center partial (clipped by circle) */}
          <polygon points="44,80 56,80 60,94 40,94" />
        </g>

        {/* Seams connecting panels */}
        <g stroke="rgba(20,20,20,0.35)" strokeWidth="1.4" fill="none">
          <path d="M50,34 L34,26 M63,44 L80,20 M58,60 L72,60 M42,60 L28,60 M37,44 L20,20" />
          <path d="M42,60 L44,80 M58,60 L56,80" />
        </g>

        <circle cx="50" cy="50" r="48" fill={`url(#${shade})`} />
        <circle cx="50" cy="50" r="48" fill={`url(#${greenRef})`} />
        <ellipse cx="38" cy="30" rx="22" ry="16" fill={`url(#${gloss})`} />
      </g>

      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  The active launch ball wrapper                                            */
/* -------------------------------------------------------------------------- */
interface FlickableFootballProps {
  size: number
  /** Full CSS transform string (translate/rotate/scale) computed by the Stage. */
  transform: string
  /** Extra visual glow (e.g. while charging a flick). */
  charged?: boolean
  /** Whether this element is actively animating (adds will-change). */
  animating?: boolean
  /** Pointer-down handler from the flick gesture (omit to disable dragging). */
  onPointerDown?: (e: React.PointerEvent) => void
  interactive?: boolean
  ariaHidden?: boolean
  opacity?: number
}

export const FlickableFootball = forwardRef<HTMLDivElement, FlickableFootballProps>(
  function FlickableFootball(
    { size, transform, charged, animating, onPointerDown, interactive, ariaHidden = true, opacity = 1 },
    ref,
  ) {
    const style: CSSProperties = {
      position: "absolute",
      width: size,
      height: size,
      transform,
      opacity,
      touchAction: interactive ? "none" : undefined,
      cursor: interactive ? "grab" : "default",
      willChange: animating ? "transform, opacity" : undefined,
      filter: charged
        ? "drop-shadow(0 0 18px rgba(168,255,25,0.75))"
        : "drop-shadow(0 10px 14px rgba(0,0,0,0.55))",
    }
    return (
      <div ref={ref} style={style} onPointerDown={onPointerDown} aria-hidden={ariaHidden}>
        <Football size={size} idPrefix="dgf-active-ball" />
      </div>
    )
  },
)
