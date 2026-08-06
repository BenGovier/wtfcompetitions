"use client"

/**
 * DgFootballStage — the interactive portrait stage for the CURRENT shot, built
 * as one fixed stage with explicit absolute layers:
 *   1 environment · 2 DG normal character · 3 mouth depth/mask ·
 *   4 football + trajectory · 5 impact · 6 scored celebration takeover ·
 *   (7 result panel lives in PrizeReveal, above this stage)
 *
 * It owns geometry (measured mouth target + launch home), the single flick
 * gesture, and the launch → flight timeline which BRANCHES on the predetermined
 * outcome:
 *   WIN  — ball flies into the mouth, passes behind the mouth mask, is absorbed,
 *          fires a mouth-centred impact, then hands to the cinematic scored
 *          takeover.
 *   MISS — ball flies convincingly at the mouth, clearly misses on its assigned
 *          deterministic path, continues beyond, then DG cross-fades to neutral.
 * It NEVER decides the result — the gesture only starts the reveal. Each phase
 * is reported up via `onPhase` so the parent keeps one typed GameState.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { GameState, DemoSettings, MissVariant, SoundCue } from "./types"
import {
  INSTRUCTIONS,
  LAUNCH_DRAG_THRESHOLD,
  LAUNCH_HOME,
  MISS_OFFSETS,
  MOUTH_TARGET,
  TIMING,
  BALL_SIZE_SELECTED,
} from "./config"
import { useFlickGesture } from "./useFlickGesture"
import { DgCharacter } from "./DgCharacter"
import { ScoredTakeover } from "./ScoredTakeover"
import { BallTray } from "./BallTray"
import { LaunchLane } from "./LaunchLane"
import { FlickableFootball } from "./FlickableFootball"
import { TrajectoryGuide } from "./TrajectoryGuide"
import { ImpactSequence } from "./ImpactSequence"

interface Pt {
  x: number
  y: number
}

interface DgFootballStageProps {
  state: GameState
  remainingNumbers: number[]
  selectedNumber: number | null
  leavingNumber: number | null
  settings: DemoSettings
  shotCurrent: number
  shotTotal: number
  /** Predetermined branch: true = ball scores, false = ball misses. */
  isWin: boolean
  /** Deterministic miss path for this shot. */
  missVariant: MissVariant
  /** Top-prize win → stronger, longer celebration. */
  bigWin: boolean
  /** Site-credit win → lighter gold celebration. */
  creditWin: boolean
  onSelectBall: (n: number) => void
  onAimStart: () => void
  onAimCancel: () => void
  onLaunch: () => void
  onPhase: (phase: GameState) => void
  playSound: (cue: SoundCue) => void
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function DgFootballStage(props: DgFootballStageProps) {
  const {
    state,
    remainingNumbers,
    selectedNumber,
    leavingNumber,
    settings,
    shotCurrent,
    shotTotal,
    isWin,
    missVariant,
    bigWin,
    creditWin,
    onSelectBall,
    onAimStart,
    onAimCancel,
    onLaunch,
    onPhase,
    playSound,
  } = props

  const slow = settings.timeScale
  const reduced = settings.reducedMotion
  const preview = settings.charPreview

  const stageRef = useRef<HTMLDivElement>(null)
  const mouthRef = useRef<HTMLDivElement>(null)

  const [stageSize, setStageSize] = useState({ w: 390, h: 844 })
  const [mouthCenter, setMouthCenter] = useState<Pt>({ x: 195, y: 380 })

  const ballSize = BALL_SIZE_SELECTED
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
    if (state === "selected") measure()
  }, [state, measure])

  /* ---- flight + impact visual state ----------------------------------- */
  const [flight, setFlight] = useState<{ pos: Pt; rot: number; scale: number; opacity: number } | null>(
    null,
  )
  const [preImpact, setPreImpact] = useState(false)
  const [impactActive, setImpactActive] = useState(false)
  const [shake, setShake] = useState(false)
  const [punch, setPunch] = useState(false)
  const [mouthEntry, setMouthEntry] = useState(false)
  const [missRipple, setMissRipple] = useState<Pt | null>(null)
  const [scoredEntering, setScoredEntering] = useState(false)
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

  // Reset per-shot visuals whenever we return to choosing / restart.
  useEffect(() => {
    if (state === "choosing" || state === "intro") {
      launchingRef.current = false
      clearTimers()
      setFlight(null)
      setPreImpact(false)
      setImpactActive(false)
      setShake(false)
      setPunch(false)
      setMouthEntry(false)
      setMissRipple(null)
      setScoredEntering(false)
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

  /* ---- WIN: mouth impact → dark transition → scored takeover ---------- */
  const runWinCelebration = useCallback(() => {
    // Impact micro-sequence originates at the MOUTH (never the chest).
    onPhase("win_impact")
    setImpactActive(true)
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
      setPunch(true)
      addTimer(() => setShake(false), TIMING.shakeMs * slow)
      addTimer(() => setPunch(false), TIMING.cameraPunchMs * slow)
    }
    addTimer(() => setImpactActive(false), TIMING.winImpactMs * slow)

    // After the impact: brief screen darken, then the scored image punches in.
    addTimer(() => {
      onPhase("win_celebration_transition")
    }, TIMING.winImpactMs * slow)

    addTimer(
      () => {
        onPhase("win_celebration")
        setScoredEntering(true)
        playSound("prize")
      },
      (TIMING.winImpactMs + TIMING.darkTransitionMs) * slow,
    )

    // Once the celebration image has settled, hand to the reveal.
    const takeover = TIMING.scoredTakeoverMs + (bigWin ? TIMING.topPrizeExtraMs : 0)
    addTimer(
      () => onPhase("suspense"),
      (TIMING.winImpactMs + TIMING.darkTransitionMs + takeover) * slow,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, slow, bigWin, settings.soundOn, onPhase, playSound])

  /* ---- MISS: near-miss ripple → cross-fade to neutral ----------------- */
  const runMissReaction = useCallback(() => {
    onPhase("miss_reaction")
    playSound("nowin")
    // DG cross-fades open → neutral (handled by derived pose); a soft green
    // side sweep helps hide the expression change.
    addTimer(() => onPhase("suspense"), (TIMING.missReactionMs + TIMING.missSettleMs) * slow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slow, onPhase, playSound])

  /* ---- the launch flight (branches on win/miss) ----------------------- */
  const startLaunch = useCallback(
    (startPos: Pt) => {
      if (launchingRef.current) return
      launchingRef.current = true
      setShowTapHint(false)
      playSound("launch")
      onLaunch()

      const win = isWin
      const baseDur = win ? TIMING.winFlightMs : TIMING.missFlightMs
      const duration = (reduced ? TIMING.reducedLaunchMs : baseDur) * slow
      const glowAt = Math.max(0, duration - TIMING.preImpactGlowLeadMs * slow)
      const start = performance.now()
      const from = startPos

      // Win → into the mouth. Miss → toward an assigned point, continuing beyond.
      const off = MISS_OFFSETS[missVariant]
      const missTarget: Pt = { x: mouthCenter.x + off.dx, y: mouthCenter.y + off.dy }
      const to: Pt = win
        ? mouthCenter
        : { x: from.x + (missTarget.x - from.x) * 1.45, y: from.y + (missTarget.y - from.y) * 1.45 }
      // Fraction of the flight at which the ball is closest to the mouth (miss).
      const closestT = 1 / 1.45

      // Announce the branch phase as the ball leaves.
      onPhase(win ? "winning_entry" : "miss_flight")

      // Pre-impact tell only applies to a scoring shot.
      if (win) {
        addTimer(() => setPreImpact(true), glowAt)
      }

      let rippled = false
      const tick = (now: number) => {
        const elapsed = now - start
        const t = Math.min(1, elapsed / duration)
        const e = reduced ? t : easeInOutCubic(t)
        const x = from.x + (to.x - from.x) * e
        const arcH = Math.min(84, stageSize.h * 0.1)
        const arc = reduced ? 0 : Math.sin(Math.PI * Math.min(1, t / (win ? 1 : 1.1))) * -arcH
        const y = from.y + (to.y - from.y) * e + arc
        const rot = reduced ? 0 : t * 1080

        if (win) {
          // Enters the mouth: from ~72% the ball goes behind the mask, compresses.
          const entering = t > 0.72
          if (entering && !mouthEntry) setMouthEntry(true)
          const scale = entering ? 1 - 0.62 * ((t - 0.72) / 0.28) * 0.75 - 0.25 * (t) : 1 - t * 0.25
          const opacity = t > 0.92 ? Math.max(0, 1 - (t - 0.92) / 0.08) : 1
          setFlight({ pos: { x, y }, rot, scale: Math.max(0.18, scale), opacity })
        } else {
          // Miss: stays visible, shrinks slightly with perspective, exits frame.
          if (!rippled && t >= closestT) {
            rippled = true
            setMissRipple({ x: mouthCenter.x + off.dx * 0.6, y: mouthCenter.y + off.dy * 0.6 })
            playSound("impact")
            addTimer(() => setMissRipple(null), 420 * slow)
          }
          const scale = 1 - Math.min(0.5, t * 0.5)
          const opacity = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1
          setFlight({ pos: { x, y }, rot, scale, opacity })
        }

        if (t < 1) {
          flightRafRef.current = requestAnimationFrame(tick)
        } else {
          flightRafRef.current = null
          setFlight(null)
          if (win) runWinCelebration()
          else runMissReaction()
        }
      }

      addTimer(() => {
        flightRafRef.current = requestAnimationFrame(tick)
      }, TIMING.tensionReleaseMs * slow)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      isWin,
      missVariant,
      mouthCenter,
      reduced,
      slow,
      stageSize.h,
      onLaunch,
      onPhase,
      playSound,
      runWinCelebration,
      runMissReaction,
      mouthEntry,
    ],
  )

  /* ---- flick gesture --------------------------------------------------- */
  const {
    bind,
    offset,
    dragging,
    upDistance,
    reset: flickReset,
  } = useFlickGesture({
    enabled: (state === "selected" || state === "aiming") && !launchingRef.current && preview === "off",
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
  const inFlightPhase =
    state === "selected" ||
    state === "aiming" ||
    state === "launching" ||
    state === "winning_entry" ||
    state === "miss_flight"
  const showActiveBall = selectedNumber != null && inFlightPhase && preview === "off"
  const charge = Math.min(1, upDistance / LAUNCH_DRAG_THRESHOLD)

  const aimCenter: Pt = { x: homePos.x + offset.x, y: homePos.y + offset.y }
  const ballCenter: Pt = flight ? flight.pos : aimCenter
  const ballRot = flight ? flight.rot : offset.x * 0.4 - upDistance * 0.6
  const ballScale = flight ? flight.scale : 1
  const ballOpacity = flight ? flight.opacity : 1
  const ballTransform = `translate(${ballCenter.x}px, ${ballCenter.y}px) translate(-50%, -50%) rotate(${ballRot}deg) scale(${ballScale})`

  const trajControl: Pt = {
    x: (aimCenter.x + mouthCenter.x) / 2 + 40,
    y: (aimCenter.y + mouthCenter.y) / 2 - 28,
  }

  const laneActive = selectedNumber != null && inFlightPhase

  /* ---- character pose (derived from the single GameState) ------------- */
  // Scored celebration owns the stage for the win branch.
  const scoredVisible =
    preview === "scored" ||
    state === "win_celebration_transition" ||
    state === "win_celebration" ||
    (state === "revealed" && isWin) ||
    (state === "transitioning_next" && isWin)
  const scoredIn =
    preview === "scored" ||
    state === "win_celebration" ||
    (state === "revealed" && isWin)
  // Normal frame shows the open mouth except after a miss / between shots.
  const showMouthOpen =
    preview === "mouth_open"
      ? true
      : preview === "neutral"
        ? false
        : !(
            state === "miss_reaction" ||
            (state === "revealed" && !isWin) ||
            state === "transitioning_next" ||
            state === "complete"
          )
  const dimCharacter = (state === "revealing" || state === "revealed") && !isWin
  const darkTransition = state === "win_celebration_transition"
  const instruction = preview === "off" ? INSTRUCTIONS[state] : null

  return (
    <div
      ref={stageRef}
      className={`dgf-stage ${shake ? "dgf-shake" : ""} ${punch ? "dgf-punch" : ""}`}
    >
      {/* ---------- Layer 1: stadium environment ---------- */}
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

      {/* ---------- Layer 2: DG normal character ---------- */}
      <div className={`dgf-character-area ${dimCharacter ? "dgf-dim" : ""}`}>
        <DgCharacter
          mouthOpen={showMouthOpen}
          hidden={scoredVisible}
          headGlow={preImpact || impactActive}
          faceSweep={preImpact}
          chestGlow={impactActive}
          reducedMotion={reduced}
          slowFactor={slow}
          showBounds={settings.showCharBounds}
        />
        {/* measured mouth target (Layer 3 anchor) */}
        <div
          ref={mouthRef}
          className={`dgf-mouth-target ${settings.showMouthTarget ? "dgf-mouth-visible" : ""}`}
          style={{ left: `${MOUTH_TARGET.xPct * 100}%`, top: `${MOUTH_TARGET.yPct * 100}%` }}
        />
      </div>

      {/* ---------- Layer 3: mouth depth + foreground mask ---------- */}
      <div
        className={`dgf-mouth-mask ${mouthEntry ? "dgf-mouth-mask-on" : ""} ${
          settings.showMouthMask ? "dgf-mouth-mask-debug" : ""
        }`}
        style={{ left: mouthCenter.x, top: mouthCenter.y }}
        aria-hidden="true"
      />

      {/* ---------- active launch lane (between DG and tray) ---------- */}
      <LaunchLane
        width={stageSize.w}
        height={stageSize.h}
        mouth={mouthCenter}
        home={homePos}
        active={laneActive}
        charging={dragging}
        reducedMotion={reduced}
      />

      {/* ---------- instruction ---------- */}
      <div className="dgf-instruction-wrap" aria-hidden={instruction ? undefined : true}>
        {instruction && (
          <p key={state} className="dgf-instruction">
            {instruction.text} <span className="dgf-instruction-key">{instruction.key}</span>
            {instruction.sub && <span className="dgf-instruction-sub">{instruction.sub}</span>}
          </p>
        )}
      </div>

      {/* ---------- Layer 4: trajectory (while aiming) ---------- */}
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

      {/* ---------- Layer 4: active football ---------- */}
      {showActiveBall && (
        <FlickableFootball
          size={ballSize}
          transform={ballTransform}
          charge={charge}
          animating={dragging || flight != null}
          opacity={ballOpacity}
          interactive={state === "selected" || state === "aiming"}
          onPointerDown={state === "selected" || state === "aiming" ? bind.onPointerDown : undefined}
        />
      )}

      {/* ---------- tap-to-shoot fallback (also the keyboard shoot control) ---------- */}
      {(state === "selected" || state === "aiming") && preview === "off" && (
        <button
          type="button"
          className={`dgf-tap-shoot ${showTapHint || state === "aiming" ? "dgf-tap-visible" : ""}`}
          style={{ left: homePos.x, top: homePos.y + ballSize / 2 + 26 }}
          onClick={handleTapShoot}
          aria-label="Tap to shoot the ball at DG"
        >
          TAP TO SHOOT
        </button>
      )}

      {/* ---------- Layer 5: mouth impact ---------- */}
      <ImpactSequence active={impactActive} reducedMotion={reduced} slowFactor={slow} center={mouthCenter} />

      {/* ---------- near-miss ripple ---------- */}
      {missRipple && (
        <div className="dgf-miss-ripple" style={{ left: missRipple.x, top: missRipple.y }} aria-hidden="true" />
      )}

      {/* ---------- brief screen darken before the celebration ---------- */}
      <div className={`dgf-dark-transition ${darkTransition ? "dgf-dark-on" : ""}`} aria-hidden="true" />

      {/* ---------- Layer 6: scored celebration takeover ---------- */}
      <ScoredTakeover
        visible={scoredVisible}
        entering={scoredIn}
        bigWin={bigWin}
        credit={creditWin}
        reducedMotion={reduced}
        slowFactor={slow}
        showBounds={settings.showScoredBounds}
      />

      {/* ---------- ball tray: numbered footballs, one per ticket ---------- */}
      {preview === "off" && (
        <div className="dgf-tray-wrap">
          <BallTray
            numbers={remainingNumbers}
            selectedNumber={selectedNumber}
            leavingNumber={leavingNumber}
            disabled={state !== "choosing"}
            reducedMotion={reduced}
            slowFactor={slow}
            onSelect={onSelectBall}
          />
        </div>
      )}

      {/* ---------- dev preview badge ---------- */}
      {preview !== "off" && (
        <div className="dgf-preview-badge" aria-hidden="true">
          PREVIEW: {preview.replace("_", " ").toUpperCase()}
        </div>
      )}

      {/* ---------- prize safe-area guide ---------- */}
      {settings.showPrizeSafe && <div className="dgf-prize-safe" aria-hidden="true" />}

      {/* ---------- debug overlays (dev only) ---------- */}
      {settings.showEndpoint && (
        <svg className="dgf-guides" width={stageSize.w} height={stageSize.h} aria-hidden="true">
          <circle cx={mouthCenter.x} cy={mouthCenter.y} r={12} fill="none" stroke="#FFD84A" strokeWidth={1.5} />
          <line x1={mouthCenter.x - 16} y1={mouthCenter.y} x2={mouthCenter.x + 16} y2={mouthCenter.y} stroke="#FFD84A" />
          <line x1={mouthCenter.x} y1={mouthCenter.y - 16} x2={mouthCenter.x} y2={mouthCenter.y + 16} stroke="#FFD84A" />
          <circle cx={homePos.x} cy={homePos.y} r={ballSize / 2} fill="none" stroke="#A8FF19" strokeDasharray="3 4" />
        </svg>
      )}

      {settings.showState && (
        <div className="dgf-anim-state" aria-hidden="true">
          {state}
        </div>
      )}
    </div>
  )
}
