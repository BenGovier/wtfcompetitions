"use client"

/**
 * DgFootballStage — the pure presentational stage for DG'S BIG BALLERS.
 *
 * Layer order (back → front):
 *   1. Stadium environment (radial pitch glow + vignette)
 *   2. Brand header (logo lockup + hero instruction) + help button
 *   3. TargetBoard (the main game object — five identical mystery holes)
 *   4. DgCharacter (host, left of / partly behind the board)
 *   5. FlightLayer (the flying ball + neon energy trail) — above the board
 *   6. BallTray (five cosmetic footballs) + "TAP A BALL"
 *   7. PrizeReveal / SummaryPanel (rise from the bottom)
 *   8. Dev guide overlays (opt-in, invisible in normal play)
 *
 * The Stage owns ONE piece of imperative behaviour: the requestAnimationFrame
 * flight of the ball along a quadratic-bezier arc from the tapped tray ball to
 * the measured centre of the predetermined hole, followed by a short drop into
 * the throat. Everything else is derived from the single `state` prop so board
 * lighting, DG's pose and the ball are always consistent.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { BOARD_RECT, INSTRUCTIONS, TAP_A_BALL, TIMING } from "./config"
import type { DemoSettings, GameState, HoleId, RevealCopy } from "./types"
import { TargetBoard } from "./TargetBoard"
import { DgCharacter } from "./DgCharacter"
import { FlightLayer, type FlightHandle } from "./FlightLayer"
import { BallTray } from "./BallTray"
import { PrizeReveal, SummaryPanel, type RunSummary } from "./PrizeReveal"

interface DgFootballStageProps {
  state: GameState
  settings: DemoSettings
  /** The predetermined destination hole for the active shot. */
  destinationHole: HoleId | null
  /** Whether the active shot is a win (drives tone + DG celebration). */
  isWin: boolean
  /** Viewport-space origin of the tapped tray ball (for the flight start). */
  ballOrigin: { x: number; y: number } | null
  /** 1-based active shot index + total, for the tray/progress. */
  shotIndex: number
  shotTotal: number
  /** Next shot label (for the reveal CTA sub-line). */
  nextShotLabel: string
  isLastShot: boolean
  /** Selected cosmetic ball number for the current shot. */
  selectedNumber: number | null
  revealCopy: RevealCopy | null
  revealVisible: boolean
  summary: RunSummary
  summaryVisible: boolean
  onSelectBall: (n: number, origin: { x: number; y: number }) => void
  onNext: () => void
  onFinish: () => void
  onHelp: () => void
}

/* Which states show a lit/entered destination hole. */
const FOCUS_STATES: GameState[] = [
  "approaching_hole",
  "entering_hole",
  "win_impact",
  "nonwin_reaction",
  "win_celebration",
  "revealing",
  "revealed",
]
const ENTERED_STATES: GameState[] = [
  "entering_hole",
  "win_impact",
  "nonwin_reaction",
  "win_celebration",
  "revealing",
  "revealed",
]
const FLIGHT_STATES: GameState[] = ["launching", "approaching_hole", "entering_hole"]

const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function DgFootballStage({
  state,
  settings,
  destinationHole,
  isWin,
  ballOrigin,
  shotIndex,
  shotTotal,
  nextShotLabel,
  isLastShot,
  selectedNumber,
  revealCopy,
  revealVisible,
  summary,
  summaryVisible,
  onSelectBall,
  onNext,
  onFinish,
  onHelp,
}: DgFootballStageProps) {
  const reduced = settings.reducedMotion
  const speed = settings.speed
  const preview = settings.charPreview

  const stageRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<FlightHandle>(null)
  const rafRef = useRef<number | null>(null)
  const flightTokenRef = useRef(0)

  // Debug geometry captured at flight start (stage-local px).
  const [debugGeom, setDebugGeom] = useState<{
    origin: { x: number; y: number }
    control: { x: number; y: number }
    endpoint: { x: number; y: number }
  } | null>(null)

  /* ---- measure a hole's centre in stage-local pixels ---- */
  const measureHole = useCallback((hole: HoleId) => {
    const stage = stageRef.current
    if (!stage) return null
    const marker = stage.querySelector<HTMLElement>(`[data-hole="${hole}"] .dgf-hole-centre`)
    if (!marker) return null
    const s = stage.getBoundingClientRect()
    const m = marker.getBoundingClientRect()
    return { x: m.left + m.width / 2 - s.left, y: m.top + m.height / 2 - s.top }
  }, [])

  /* ---- run the flight when we enter "launching" ---- */
  useEffect(() => {
    if (state !== "launching") return
    if (!ballOrigin || destinationHole == null) return
    const stage = stageRef.current
    const flight = flightRef.current
    if (!stage || !flight) return

    const token = ++flightTokenRef.current
    const s = stage.getBoundingClientRect()
    const origin = { x: ballOrigin.x - s.left, y: ballOrigin.y - s.top }
    const target = measureHole(destinationHole)
    if (!target) return

    // Quadratic-bezier control point: arc up and lean toward the board.
    const dist = Math.hypot(target.x - origin.x, target.y - origin.y)
    const arcLift = Math.max(90, dist * 0.32)
    const control = {
      x: origin.x + (target.x - origin.x) * 0.52,
      y: Math.min(origin.y, target.y) - arcLift,
    }
    setDebugGeom({ origin, control, endpoint: target })

    const dir = target.x >= origin.x ? 1 : -1
    const arcMs = (reduced ? TIMING.reducedFlightMs : TIMING.flightMs) * speed
    const dropMs = TIMING.holeEntryMs * speed
    const startAt = performance.now()

    flight.begin(origin.x, origin.y)

    const tick = (now: number) => {
      if (flightTokenRef.current !== token) return
      const elapsed = now - startAt

      if (elapsed <= arcMs) {
        // Phase A — arc toward the hole.
        const t = cubicOut(Math.min(1, elapsed / arcMs))
        const mt = 1 - t
        const x = mt * mt * origin.x + 2 * mt * t * control.x + t * t * target.x
        const y = mt * mt * origin.y + 2 * mt * t * control.y + t * t * target.y
        const rot = reduced ? 0 : dir * t * 540
        const scale = 1 - 0.18 * t // slight perspective shrink toward the board
        flight.frame(x, y, rot, scale, 1)
        rafRef.current = requestAnimationFrame(tick)
      } else if (elapsed <= arcMs + dropMs) {
        // Phase B — drop into the throat: shrink + fade at the hole centre.
        const t = Math.min(1, (elapsed - arcMs) / dropMs)
        const scale = 0.82 * (1 - 0.72 * t)
        const opacity = 1 - t
        flight.frame(target.x, target.y + t * 8, dir * (540 + t * 120), scale, opacity)
        rafRef.current = requestAnimationFrame(tick)
      } else {
        flight.end()
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Ensure the ball is hidden whenever we are not mid-flight.
  useEffect(() => {
    if (!FLIGHT_STATES.includes(state)) flightRef.current?.end()
  }, [state])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /* ---- derived board lighting from state ---- */
  const pulse = state === "launching"
  const focusHole = FOCUS_STATES.includes(state) ? destinationHole : null
  const enteredHole = ENTERED_STATES.includes(state) ? destinationHole : null
  const resultTone: "win" | "nonwin" | null =
    ["win_impact", "win_celebration", "revealing", "revealed"].includes(state) && isWin
      ? "win"
      : ["nonwin_reaction", "revealing", "revealed"].includes(state) && !isWin
        ? "nonwin"
        : null

  /* ---- DG pose ---- */
  const livePose: "neutral" | "scored" =
    ["win_impact", "win_celebration", "revealing", "revealed"].includes(state) && isWin ? "scored" : "neutral"
  const pose = preview === "off" ? livePose : preview === "scored" ? "scored" : "neutral"
  const winFlash = preview === "off" && (state === "win_impact" || state === "win_celebration")
  const dimCharacter = (state === "revealing" || state === "revealed") && !isWin

  /* ---- brand + instruction ---- */
  const brandHidden = (revealVisible && isWin) || summaryVisible || ["win_impact", "win_celebration"].includes(state)
  const instruction = preview === "off" ? INSTRUCTIONS[state] : null

  const trayDisabled = state !== "choosing" || preview !== "off"
  const hideSelected =
    selectedNumber != null &&
    [
      "launching",
      "approaching_hole",
      "entering_hole",
      "win_impact",
      "nonwin_reaction",
      "win_celebration",
      "revealing",
      "revealed",
    ].includes(state)

  const stageClasses = [
    "dgf-stage",
    state === "win_impact" && !reduced ? "dgf-punch" : "",
    state === "win_impact" && !reduced ? "dgf-shake" : "",
  ]
    .filter(Boolean)
    .join(" ")

  const boardStyle = {
    left: `${BOARD_RECT.leftPct * 100}%`,
    top: `${BOARD_RECT.topPct * 100}%`,
    width: `${BOARD_RECT.widthPct * 100}%`,
    height: `${BOARD_RECT.heightPct * 100}%`,
  } as const

  return (
    <div ref={stageRef} className={stageClasses}>
      {/* 1. Environment */}
      <div className="dgf-env" aria-hidden="true">
        <div className="dgf-env-pitch" />
        <div className="dgf-env-glow" />
        <div className="dgf-env-vignette" />
      </div>

      {/* 2. Brand header + help */}
      <header className={`dgf-brand ${brandHidden ? "dgf-brand-hidden" : ""}`}>
        <button type="button" className="dgf-help-btn" onClick={onHelp} aria-label="How it works">
          ?
        </button>
        <div className="dgf-brand-lockup" aria-label="DG'S BIG BALLERS">
          <span className="dgf-brand-kicker">DG&apos;S</span>
          <span className="dgf-brand-title">BIG BALLERS</span>
        </div>
        {instruction && (
          <div className="dgf-instruction" aria-live="polite">
            <span className="dgf-instruction-text">
              {instruction.text} {instruction.key && <span className="dgf-instruction-key">{instruction.key}</span>}
            </span>
            {instruction.sub && <span className="dgf-instruction-sub">{instruction.sub}</span>}
          </div>
        )}
      </header>

      {/* 3 + 4 + 5. Board area (board, DG, flight share this positioned box) */}
      <div className="dgf-board-area" style={boardStyle}>
        <DgCharacter
          pose={pose}
          winFlash={winFlash}
          dim={dimCharacter}
          reducedMotion={reduced}
          speed={speed}
          showBounds={settings.showBoardBounds}
        />
        <TargetBoard
          pulse={pulse}
          focusHole={focusHole}
          enteredHole={enteredHole}
          resultTone={resultTone}
          reducedMotion={reduced}
          showHoleBounds={settings.showHoleBounds}
          showHoleCentres={settings.showHoleCentres}
          showBoardBounds={settings.showBoardBounds}
        />
      </div>

      {/* Flight layer spans the whole stage so the ball can travel tray→board. */}
      <FlightLayer ref={flightRef} reducedMotion={reduced} />

      {/* 6. Ball tray + call to action */}
      <div className="dgf-tray-area">
        <div
          className={`dgf-tap-cta ${state === "choosing" && preview === "off" ? "" : "dgf-tap-cta-hidden"}`}
          aria-hidden="true"
        >
          <span className="dgf-tap-chevrons">
            <span /> <span /> <span />
          </span>
          <span className="dgf-tap-label">{TAP_A_BALL}</span>
        </div>
        <BallTray
          selectedNumber={selectedNumber}
          disabled={trayDisabled}
          hideSelected={hideSelected}
          reducedMotion={reduced}
          speed={speed}
          onSelect={onSelectBall}
        />
      </div>

      {/* 7. Reveal / summary */}
      {revealCopy && (
        <PrizeReveal
          copy={revealCopy}
          visible={revealVisible}
          reducedMotion={reduced}
          slowFactor={speed}
          isLast={isLastShot}
          shotIndex={shotIndex}
          shotTotal={shotTotal}
          shotLabel={nextShotLabel}
          onNext={onNext}
        />
      )}
      <SummaryPanel
        summary={summary}
        visible={summaryVisible}
        reducedMotion={reduced}
        slowFactor={speed}
        onFinish={onFinish}
      />

      {/* 8. Dev guide overlays */}
      {settings.showState && (
        <div className="dgf-state-badge" aria-hidden="true">
          {state}
          {destinationHole != null && ` · hole ${destinationHole}`}
        </div>
      )}
      {debugGeom && (settings.showBallOrigin || settings.showControlPoints || settings.showEndpoint) && (
        <svg className="dgf-guide-svg" aria-hidden="true">
          {settings.showControlPoints && (
            <>
              <line
                className="dgf-guide-line"
                x1={debugGeom.origin.x}
                y1={debugGeom.origin.y}
                x2={debugGeom.control.x}
                y2={debugGeom.control.y}
              />
              <line
                className="dgf-guide-line"
                x1={debugGeom.control.x}
                y1={debugGeom.control.y}
                x2={debugGeom.endpoint.x}
                y2={debugGeom.endpoint.y}
              />
              <circle className="dgf-guide-ctrl" cx={debugGeom.control.x} cy={debugGeom.control.y} r={6} />
            </>
          )}
          {settings.showBallOrigin && (
            <circle className="dgf-guide-origin" cx={debugGeom.origin.x} cy={debugGeom.origin.y} r={6} />
          )}
          {settings.showEndpoint && (
            <circle className="dgf-guide-endpoint" cx={debugGeom.endpoint.x} cy={debugGeom.endpoint.y} r={6} />
          )}
        </svg>
      )}
    </div>
  )
}
