"use client"

/**
 * DgFootballStage — the interactive portrait stage for the CURRENT shot.
 *
 * Owns geometry (measured mouth target + launch home via getBoundingClientRect),
 * the single Pointer-Events flick gesture, the launch flight (rAF cubic-bezier),
 * the expression cross-fade timing and the impact micro-sequence. It NEVER
 * decides the result — the outcome is predetermined and only revealed after the
 * ball reaches DG. Each core transition is reported up via a callback so the
 * parent keeps one typed GameState.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { GameState, DemoSettings, SoundCue } from "./types"
import {
  INSTRUCTIONS,
  LAUNCH_DRAG_THRESHOLD,
  LAUNCH_HOME,
  MOUTH_TARGET,
  TIMING,
  BALL_SIZE,
} from "./config"
import { useFlickGesture } from "./useFlickGesture"
import { DgCharacter } from "./DgCharacter"
import { BallTray } from "./BallTray"
import { FlickableFootball } from "./FlickableFootball"
import { TrajectoryGuide } from "./TrajectoryGuide"
import { ImpactSequence } from "./ImpactSequence"

interface Pt {
  x: number
  y: number
}

interface DgFootballStageProps {
  state: GameState
  /** How many footballs to render (always five). */
  ballCount: number
  /** The chosen football index for THIS shot (presentation only), or null. */
  selectedBallIndex: number | null
  settings: DemoSettings
  /** 1-based index of the ticket being revealed. */
  shotCurrent: number
  /** Total tickets in the reveal queue (1 → hundreds). */
  shotTotal: number
  onSelectBall: (index: number) => void
  onAimStart: () => void
  onAimCancel: () => void
  onLaunch: () => void
  onImpact: () => void
  onImpactComplete: () => void
  playSound: (cue: SoundCue) => void
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function DgFootballStage(props: DgFootballStageProps) {
  const {
    state,
    ballCount,
    selectedBallIndex,
    settings,
    shotCurrent,
    shotTotal,
    onSelectBall,
    onAimStart,
    onAimCancel,
    onLaunch,
    onImpact,
    onImpactComplete,
    playSound,
  } = props

  const slow = settings.slowMotion ? 3 : 1
  const reduced = settings.reducedMotion

  const stageRef = useRef<HTMLDivElement>(null)
  const mouthRef = useRef<HTMLDivElement>(null)

  const [stageSize, setStageSize] = useState({ w: 390, h: 844 })
  const [mouthCenter, setMouthCenter] = useState<Pt>({ x: 195, y: 384 })

  const ballSize = BALL_SIZE
  const homePos: Pt = { x: stageSize.w * LAUNCH_HOME.xPct, y: stageSize.h * LAUNCH_HOME.yPct }

  /* ---- geometry measurement ------------------------------------------- */
  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    setStageSize({ w: rect.width, h: rect.height })
    const mouth = mouthRef.current
    if (mouth) {
      const m = mouth.getBoundingClientRect()
      setMouthCenter({ x: m.left - rect.left + m.width / 2, y: m.top - rect.top + m.height / 2 })
    } else {
      setMouthCenter({ x: rect.width * MOUTH_TARGET.xPct, y: rect.height * MOUTH_TARGET.yPct })
    }
  }, [])

  useLayoutEffect(() => {
    measure()
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => measure())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    // Re-measure whenever we re-enter an interactive shot.
    if (state === "selected") measure()
  }, [state, measure])

  /* ---- flight animation state ----------------------------------------- */
  // Ball centre while flying (stage-local). Null when not flying.
  const [flight, setFlight] = useState<{ pos: Pt; rot: number; scale: number; opacity: number } | null>(
    null,
  )
  const [mouthOpen, setMouthOpen] = useState(false)
  const [impactActive, setImpactActive] = useState(false)
  const [logoFlash, setLogoFlash] = useState(false)
  const [shake, setShake] = useState(false)
  const [showTapHint, setShowTapHint] = useState(false)

  const flightRafRef = useRef<number | null>(null)
  const timersRef = useRef<number[]>([])
  const launchingRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    if (flightRafRef.current != null) {
      cancelAnimationFrame(flightRafRef.current)
      flightRafRef.current = null
    }
  }, [])

  const addTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }

  // Reset per-shot visuals whenever we leave the reveal/return to choosing.
  useEffect(() => {
    if (state === "choosing" || state === "next_ticket" || state === "intro") {
      launchingRef.current = false
      setFlight(null)
      setMouthOpen(false)
      setImpactActive(false)
      setLogoFlash(false)
      setShake(false)
      setShowTapHint(false)
      flickReset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => () => clearTimers(), [clearTimers])

  /* ---- tap-to-shoot hint after inactivity ----------------------------- */
  useEffect(() => {
    if (state !== "selected") {
      setShowTapHint(false)
      return
    }
    const id = window.setTimeout(() => setShowTapHint(true), TIMING.tapHintDelayMs * slow)
    return () => window.clearTimeout(id)
  }, [state, slow])

  /* ---- the launch flight ---------------------------------------------- */
  const startLaunch = useCallback(
    (startPos: Pt) => {
      if (launchingRef.current) return
      launchingRef.current = true
      setShowTapHint(false)
      playSound("launch")
      onLaunch()

      const duration = (reduced ? TIMING.reducedLaunchMs : (TIMING.launchMinMs + TIMING.launchMaxMs) / 2) * slow
      const crossfadeAt = Math.max(0, duration - TIMING.crossfadeLeadMs * slow)
      const start = performance.now()
      const from = startPos
      const to = mouthCenter

      // schedule the mouth-open cross-fade ~180ms before impact
      addTimer(() => setMouthOpen(true), crossfadeAt)

      const tick = (now: number) => {
        const elapsed = now - start
        const t = Math.min(1, elapsed / duration)
        const e = reduced ? t : easeInOutCubic(t)
        const x = from.x + (to.x - from.x) * e
        // add a slight arc lift on the way (non-reduced only)
        const arc = reduced ? 0 : Math.sin(Math.PI * t) * -Math.min(70, stageSize.h * 0.09)
        const y = from.y + (to.y - from.y) * e + arc
        const rot = reduced ? 0 : t * 1080
        const scale = 1 - t * 0.55
        const opacity = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.1) : 1
        setFlight({ pos: { x, y }, rot, scale, opacity })
        if (t < 1) {
          flightRafRef.current = requestAnimationFrame(tick)
        } else {
          flightRafRef.current = null
          runImpact()
        }
      }
      flightRafRef.current = requestAnimationFrame(tick)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [mouthCenter, reduced, slow, stageSize.h, onLaunch, playSound],
  )

  const runImpact = useCallback(() => {
    setMouthOpen(true)
    setFlight(null)
    setImpactActive(true)
    setLogoFlash(true)
    onImpact()
    playSound("impact")
    if (typeof navigator !== "undefined" && "vibrate" in navigator && settings.soundOn) {
      try {
        navigator.vibrate?.([18, 40, 24])
      } catch {
        /* best effort */
      }
    }
    if (!reduced) {
      setShake(true)
      addTimer(() => setShake(false), TIMING.shakeMs * slow)
    }
    addTimer(() => setLogoFlash(false), 320 * slow)
    addTimer(() => {
      setImpactActive(false)
      addTimer(() => {
        launchingRef.current = false
        onImpactComplete()
      }, TIMING.holdMs * slow)
    }, TIMING.impactMs * slow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, slow, settings.soundOn, onImpact, onImpactComplete, playSound])

  /* ---- flick gesture --------------------------------------------------- */
  const {
    bind,
    offset,
    dragging,
    upDistance,
    reset: flickReset,
  } = useFlickGesture({
    enabled: (state === "selected" || state === "aiming") && !launchingRef.current,
    threshold: LAUNCH_DRAG_THRESHOLD,
    horizontalDamp: 0.4,
    onDragStart: () => {
      if (state === "selected") {
        onAimStart()
        playSound("charge")
      }
    },
    onRelease: ({ launched }) => {
      if (launchingRef.current) return
      if (launched) {
        const releasePos: Pt = { x: homePos.x + offset.x, y: homePos.y + offset.y }
        startLaunch(releasePos)
      } else {
        onAimCancel()
      }
    },
  })

  const handleTapShoot = useCallback(() => {
    if (launchingRef.current) return
    if (state === "selected" || state === "aiming") startLaunch(homePos)
  }, [state, homePos, startLaunch])

  /* ---- derived render values ------------------------------------------ */
  const showActiveBall =
    selectedBallIndex != null && (state === "selected" || state === "aiming" || state === "launched")
  const charge = Math.min(1, upDistance / LAUNCH_DRAG_THRESHOLD)

  // Active ball centre while aiming/selected (drag offset applied).
  const aimCenter: Pt = { x: homePos.x + offset.x, y: homePos.y + offset.y }
  const ballCenter: Pt = flight ? flight.pos : aimCenter
  const ballRot = flight ? flight.rot : offset.x * 0.4 - upDistance * 0.6
  const ballScale = flight ? flight.scale : 1
  const ballOpacity = flight ? flight.opacity : 1

  const ballTransform = `translate(${ballCenter.x}px, ${ballCenter.y}px) translate(-50%, -50%) rotate(${ballRot}deg) scale(${ballScale})`

  // Trajectory control point: bow the path to the side of the straight line.
  const trajControl: Pt = {
    x: (aimCenter.x + mouthCenter.x) / 2 + 46,
    y: (aimCenter.y + mouthCenter.y) / 2 - 30,
  }

  const instruction = INSTRUCTIONS[state]

  return (
    <div ref={stageRef} className={`dgf-stage ${shake ? "dgf-shake" : ""}`}>
      {/* ---------- stadium environment (back) ---------- */}
      <div className="dgf-env" aria-hidden="true">
        <div className="dgf-floodlights" />
        <div className="dgf-dg-glow" />
        <div className="dgf-pitch" />
        <div className="dgf-grain" />
        {!reduced && (
          <div className="dgf-particles">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="dgf-particle" style={{ animationDuration: `${8 + i}s` }} />
            ))}
          </div>
        )}
        <div className="dgf-vignette" />
      </div>

      {/* ---------- brand bar ---------- */}
      <header className="dgf-brand">
        <div className="dgf-brand-titles">
          <span className="dgf-brand-1">DG&apos;S</span>
          <span className="dgf-brand-2">BIG BALLERS</span>
        </div>
        <p className="dgf-brand-sub">EVERY TICKET TAKES A SHOT</p>
        <p className="dgf-progress" aria-hidden="true">
          SHOT {shotCurrent} OF {shotTotal}
        </p>
      </header>

      {/* ---------- character area ---------- */}
      <div className={`dgf-character-area ${state === "revealing" || state === "revealed" ? "dgf-dim" : ""}`}>
        <DgCharacter mouthOpen={mouthOpen} reducedMotion={reduced} slowFactor={slow} logoFlash={logoFlash} />
        {/* measured mouth target */}
        <div
          ref={mouthRef}
          className={`dgf-mouth-target ${settings.showMouthTarget ? "dgf-mouth-visible" : ""}`}
          style={{ left: `${MOUTH_TARGET.xPct * 100}%`, top: `${MOUTH_TARGET.yPct * 100}%` }}
        />
      </div>

      {/* ---------- instruction ---------- */}
      <div className="dgf-instruction-wrap" aria-hidden={instruction ? undefined : true}>
        {instruction && (
          <p key={state} className="dgf-instruction">
            {instruction.text} <span className="dgf-instruction-key">{instruction.key}</span>
          </p>
        )}
      </div>

      {/* ---------- trajectory (while aiming) ---------- */}
      {state === "aiming" && dragging && (
        <TrajectoryGuide
          width={stageSize.w}
          height={stageSize.h}
          from={aimCenter}
          control={trajControl}
          to={mouthCenter}
          charge={charge}
          reducedMotion={reduced}
        />
      )}

      {/* ---------- alignment guides (dev) ---------- */}
      {settings.showGuides && (
        <svg className="dgf-guides" width={stageSize.w} height={stageSize.h} aria-hidden="true">
          <line x1={stageSize.w / 2} y1={0} x2={stageSize.w / 2} y2={stageSize.h} stroke="#5DFF00" strokeDasharray="4 6" />
          <circle cx={mouthCenter.x} cy={mouthCenter.y} r={10} fill="none" stroke="#FFD84A" strokeWidth={1.5} />
          <line x1={mouthCenter.x - 14} y1={mouthCenter.y} x2={mouthCenter.x + 14} y2={mouthCenter.y} stroke="#FFD84A" />
          <line x1={mouthCenter.x} y1={mouthCenter.y - 14} x2={mouthCenter.x} y2={mouthCenter.y + 14} stroke="#FFD84A" />
          <circle cx={homePos.x} cy={homePos.y} r={ballSize / 2} fill="none" stroke="#A8FF19" strokeDasharray="3 4" />
        </svg>
      )}

      {/* ---------- active football ---------- */}
      {showActiveBall && (
        <FlickableFootball
          size={ballSize}
          transform={ballTransform}
          charged={dragging && charge > 0.2}
          animating={dragging || flight != null}
          opacity={ballOpacity}
          interactive={state === "selected" || state === "aiming"}
          onPointerDown={
            state === "selected" || state === "aiming" ? bind.onPointerDown : undefined
          }
        />
      )}

      {/* ---------- tap-to-shoot fallback (also the keyboard shoot control) ---------- */}
      {(state === "selected" || state === "aiming") && (
        <button
          type="button"
          className={`dgf-tap-shoot ${showTapHint || state === "aiming" ? "dgf-tap-visible" : ""}`}
          style={{ left: homePos.x, top: homePos.y + ballSize / 2 + 30 }}
          onClick={handleTapShoot}
          aria-label="Tap to shoot the ball at DG"
        >
          TAP TO SHOOT
        </button>
      )}

      {/* ---------- impact ---------- */}
      <ImpactSequence active={impactActive} reducedMotion={reduced} slowFactor={slow} center={mouthCenter} />

      {/* ---------- ball tray: five reusable, unlabelled footballs ---------- */}
      <div className="dgf-tray-wrap">
        <BallTray
          ballCount={ballCount}
          selectedIndex={selectedBallIndex}
          disabled={state !== "choosing"}
          reducedMotion={reduced}
          slowFactor={slow}
          onSelect={onSelectBall}
        />
      </div>
    </div>
  )
}
