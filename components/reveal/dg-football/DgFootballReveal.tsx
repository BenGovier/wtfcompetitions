"use client"

/**
 * DgFootballReveal — the orchestrator and single source of truth for GameState.
 *
 * INTERACTION MODEL (approved "tap-a-ball → auto shot → into a hole" mechanic):
 *  - The customer performs ONE interaction for the WHOLE purchase: TAP A BALL.
 *    The five tray footballs are COSMETIC — the tapped one never decides
 *    anything.
 *  - The purchase has a PREDETERMINED reveal plan (`plan.awards`). One tap
 *    reveals every result: winning results auto-chain (up to MAX_ANIMATED_WINS
 *    full animations, the rest summarised) so a 500-ticket buyer never has to
 *    interact 500 times.
 *  - Each animated shot flies the ball into its predetermined hole; that hole
 *    becomes the source of the reaction (win burst / non-win pulse).
 *
 * The Stage is a pure renderer: it derives all board lighting, DG's pose and
 * the ball's flight from the single `state` prop + the active animation. This
 * orchestrator owns the timed walk through the state machine (every duration
 * comes from TIMING and is scaled by the dev `speed`).
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { Animation, DemoSettings, GameState, HoleId, SoundCue } from "./types"
import {
  buildAnimations,
  buildRevealPlan,
  isBigWin,
  MAX_ANIMATED_WINS,
  revealCopyFor,
  summarisePlan,
  TIMING,
} from "./config"
import { DgFootballStage } from "./DgFootballStage"

interface RevealStateShape {
  state: GameState
  /** Cosmetic ball number tapped to start the session (1..5), else null. */
  tappedBall: number | null
  /** Which animation (win or the single non-win) we are currently playing. */
  animIndex: number
}

type Action =
  | { type: "INTRO_DONE" }
  | { type: "SELECT"; ball: number }
  | { type: "GOTO"; from: GameState; to: GameState }
  | { type: "RELAUNCH" }
  | { type: "CONTINUE_TO_SUMMARY"; from: GameState }

function makeInitial(skipIntro: boolean): RevealStateShape {
  return { state: skipIntro ? "choosing" : "intro", tappedBall: null, animIndex: 0 }
}

function reducer(s: RevealStateShape, a: Action): RevealStateShape {
  switch (a.type) {
    case "INTRO_DONE":
      return s.state === "intro" ? { ...s, state: "choosing" } : s
    case "SELECT":
      return s.state === "choosing" ? { ...s, state: "selected", tappedBall: a.ball } : s
    case "GOTO":
      return s.state === a.from ? { ...s, state: a.to } : s
    case "RELAUNCH":
      // Advance to the next animated win and fire it automatically.
      return s.state === "auto_relaunch"
        ? { ...s, state: "launching", animIndex: s.animIndex + 1 }
        : s
    case "CONTINUE_TO_SUMMARY":
      return s.state === a.from ? { ...s, state: "summary" } : s
    default:
      return s
  }
}

interface DgFootballRevealProps {
  settings: DemoSettings
  playSound: (cue: SoundCue) => void
  onFinish: () => void
  onHelp: () => void
}

export function DgFootballReveal({ settings, playSound, onFinish, onHelp }: DgFootballRevealProps) {
  const speed = settings.speed

  const [s, dispatch] = useReducer(reducer, undefined, () => makeInitial(settings.skipIntro))

  /* ---- predetermined plan + animation list ----------------------------- */
  const plan = useMemo(
    () => buildRevealPlan(settings.resultPreset, settings.ticketCount),
    [settings.resultPreset, settings.ticketCount],
  )
  const summary = useMemo(() => summarisePlan(plan), [plan])

  const animations: Animation[] = useMemo(() => {
    if (s.tappedBall == null) return []
    const list = buildAnimations(plan, s.tappedBall)
    // Dev: force the FIRST animation's hole for staging (outcome unchanged).
    if (settings.destination !== "auto" && list.length > 0) {
      list[0] = { ...list[0], destinationHole: settings.destination as HoleId }
    }
    return list
  }, [plan, s.tappedBall, settings.destination])

  const active = animations[s.animIndex] ?? null
  const isWin = active?.isWin ?? false
  const bigWin = active ? isBigWin(active.outcome) : false
  const destinationHole: HoleId | null = active?.destinationHole ?? null
  const activeBall = active?.ballNumber ?? null
  const hasMoreAnimated = s.animIndex + 1 < animations.length

  /* ---- timed walk through the state machine ---------------------------- */
  const go = useCallback((from: GameState, to: GameState) => dispatch({ type: "GOTO", from, to }), [])

  // intro → choosing
  useEffect(() => {
    if (s.state !== "intro") return
    const id = window.setTimeout(() => dispatch({ type: "INTRO_DONE" }), TIMING.introMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed])

  // selected → launching (short hold, then the shot fires itself)
  useEffect(() => {
    if (s.state !== "selected") return
    playSound("select")
    const id = window.setTimeout(() => go("selected", "launching"), TIMING.selectHoldMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, go, playSound])

  // launching → approaching_hole
  useEffect(() => {
    if (s.state !== "launching") return
    playSound("launch")
    const flightDur = (settings.reducedMotion ? TIMING.reducedFlightMs : TIMING.flightMs) * speed
    const lead = Math.min(TIMING.anticipationLeadMs * speed, flightDur)
    const id = window.setTimeout(() => go("launching", "approaching_hole"), Math.max(0, flightDur - lead))
    return () => window.clearTimeout(id)
  }, [s.state, speed, settings.reducedMotion, go, playSound])

  // approaching_hole → entering_hole
  useEffect(() => {
    if (s.state !== "approaching_hole") return
    playSound("whoosh")
    const flightDur = (settings.reducedMotion ? TIMING.reducedFlightMs : TIMING.flightMs) * speed
    const lead = Math.min(TIMING.anticipationLeadMs * speed, flightDur)
    const id = window.setTimeout(() => go("approaching_hole", "entering_hole"), lead)
    return () => window.clearTimeout(id)
  }, [s.state, speed, settings.reducedMotion, go, playSound])

  // entering_hole → suspense
  useEffect(() => {
    if (s.state !== "entering_hole") return
    playSound("drop")
    const id = window.setTimeout(() => go("entering_hole", "suspense"), TIMING.holeEntryMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, go, playSound])

  // suspense → win_reaction | nonwin_reaction (theatrical, not "loading")
  useEffect(() => {
    if (s.state !== "suspense") return
    playSound("suspense")
    const dur = (bigWin ? TIMING.suspenseBigMs : TIMING.suspenseMs) * speed
    const id = window.setTimeout(() => {
      dispatch({ type: "GOTO", from: "suspense", to: isWin ? "win_reaction" : "nonwin_reaction" })
    }, dur)
    return () => window.clearTimeout(id)
  }, [s.state, speed, isWin, bigWin, playSound])

  // win_reaction → celebrating (the hole is the source of the celebration)
  useEffect(() => {
    if (s.state !== "win_reaction") return
    playSound(bigWin ? "prize" : "impact")
    if (typeof navigator !== "undefined" && "vibrate" in navigator && settings.soundOn) {
      try {
        navigator.vibrate?.(bigWin ? [18, 40, 26, 40, 30] : [16, 40, 22])
      } catch {
        /* best effort */
      }
    }
    const id = window.setTimeout(() => go("win_reaction", "celebrating"), TIMING.winReactionMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, bigWin, settings.soundOn, go, playSound])

  // celebrating → revealing (DG neutral → scored entrance)
  useEffect(() => {
    if (s.state !== "celebrating") return
    const id = window.setTimeout(
      () => go("celebrating", "revealing"),
      (TIMING.celebrateMs + TIMING.pauseBeforePanelMs) * speed,
    )
    return () => window.clearTimeout(id)
  }, [s.state, speed, go])

  // revealing → revealed
  useEffect(() => {
    if (s.state !== "revealing") return
    playSound(active?.outcome.kind === "credit" ? "credit" : "prize")
    const id = window.setTimeout(() => go("revealing", "revealed"), TIMING.panelRiseMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, active, go, playSound])

  // revealed → checking_additional (more wins) | summary (done)
  useEffect(() => {
    if (s.state !== "revealed") return
    const hold = (bigWin ? TIMING.prizeHoldBigMs : TIMING.prizeHoldMs) * speed
    const id = window.setTimeout(() => {
      if (hasMoreAnimated) go("revealed", "checking_additional")
      else dispatch({ type: "CONTINUE_TO_SUMMARY", from: "revealed" })
    }, hold)
    return () => window.clearTimeout(id)
  }, [s.state, speed, bigWin, hasMoreAnimated, go])

  // checking_additional → auto_relaunch
  useEffect(() => {
    if (s.state !== "checking_additional") return
    playSound("another")
    const id = window.setTimeout(() => go("checking_additional", "auto_relaunch"), TIMING.interstitialMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, go, playSound])

  // auto_relaunch → launching (advance to the next win, fire automatically)
  useEffect(() => {
    if (s.state !== "auto_relaunch") return
    const id = window.setTimeout(() => dispatch({ type: "RELAUNCH" }), TIMING.relaunchLiftMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed])

  // nonwin_reaction → summary
  useEffect(() => {
    if (s.state !== "nonwin_reaction") return
    playSound("nowin")
    const id = window.setTimeout(
      () => dispatch({ type: "CONTINUE_TO_SUMMARY", from: "nonwin_reaction" }),
      (TIMING.nonwinReactionMs + TIMING.summaryDelayMs) * speed,
    )
    return () => window.clearTimeout(id)
  }, [s.state, speed, playSound])

  /* ---- callbacks ------------------------------------------------------- */
  const onSelectBall = useCallback((n: number) => dispatch({ type: "SELECT", ball: n }), [])

  /* ---- derived reveal copy + interstitial ------------------------------ */
  const revealCopy = active && active.isWin ? revealCopyFor(active.outcome) : null
  const revealVisible = isWin && (s.state === "revealing" || s.state === "revealed")

  // "THERE'S ANOTHER WIN!" (2nd) → "ANOTHER ONE!" (3rd+).
  const interstitialText = s.animIndex === 0 ? "THERE'S ANOTHER WIN!" : "ANOTHER ONE!"

  const winSoFar = s.animIndex + 1
  const totalAnimatedWins = animations.filter((a) => a.isWin).length

  return (
    <div className="dgf-reveal-root">
      <DgFootballStage
        state={s.state}
        settings={settings}
        ticketCount={plan.ticketCount}
        destinationHole={destinationHole}
        isWin={isWin}
        bigWin={bigWin}
        activeBall={activeBall}
        tappedBall={s.tappedBall}
        winSoFar={winSoFar}
        totalAnimatedWins={totalAnimatedWins}
        interstitialText={interstitialText}
        revealCopy={revealCopy}
        revealVisible={revealVisible}
        summary={summary}
        summaryVisible={s.state === "summary"}
        maxAnimated={MAX_ANIMATED_WINS}
        onSelectBall={onSelectBall}
        onFinish={onFinish}
        onHelp={onHelp}
      />

      {/* Live region for the result (screen-reader announcement). */}
      <div className="sr-only" role="status" aria-live="polite">
        {s.state === "revealed" && revealCopy
          ? `${revealCopy.eyebrow} ${revealCopy.amount} ${revealCopy.unit}. ${revealCopy.support}.`
          : s.state === "summary"
            ? `${plan.ticketCount} tickets checked. ${summary.instantWins} instant wins.`
            : ""}
      </div>
    </div>
  )
}
