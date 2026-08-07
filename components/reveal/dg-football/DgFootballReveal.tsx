"use client"

/**
 * DgFootballReveal — the orchestrator and single source of truth for GameState.
 *
 * INTERACTION MODEL (new "tap-a-ball → auto shot → into a hole" mechanic):
 *  - The customer performs ONE interaction per shot: TAP A BALL. The five tray
 *    footballs are COSMETIC — the tapped one never decides anything.
 *  - Each purchased ticket (`tickets[i]`) is one shot with a PREDETERMINED
 *    `outcome` and `destinationHole`. Shots are played in order.
 *  - On tap, the selected ball automatically launches into the target board and
 *    visibly enters its ticket's hole; that hole then reveals the result.
 *
 * The Stage is a pure renderer: it derives all board lighting, DG's pose and
 * the ball's flight from the single `state` prop. This orchestrator owns the
 * timed walk through the state machine (every duration comes from TIMING and is
 * scaled by the dev `speed`), so the animation and the state stay in lockstep.
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { DemoSettings, GameState, HoleId, SoundCue, Ticket } from "./types"
import { isBigWin, revealCopyFor, TIMING } from "./config"
import { DgFootballStage } from "./DgFootballStage"
import type { RunSummary } from "./PrizeReveal"

interface RevealStateShape {
  state: GameState
  /** Number of shots fully played (also the active ticket index). */
  playedCount: number
  /** Cosmetic ball number tapped for the CURRENT shot (1..5), else null. */
  selectedNumber: number | null
  /** Viewport-space origin of the tapped ball, for the flight start. */
  ballOrigin: { x: number; y: number } | null
}

type Action =
  | { type: "INTRO_DONE" }
  | { type: "SELECT"; number: number; origin: { x: number; y: number } }
  | { type: "GOTO"; from: GameState; to: GameState }
  | { type: "NEXT" }
  | { type: "ADVANCE"; total: number }

function makeInitial(skipIntro: boolean): RevealStateShape {
  return {
    state: skipIntro ? "choosing" : "intro",
    playedCount: 0,
    selectedNumber: null,
    ballOrigin: null,
  }
}

function reducer(s: RevealStateShape, a: Action): RevealStateShape {
  switch (a.type) {
    case "INTRO_DONE":
      return s.state === "intro" ? { ...s, state: "choosing" } : s
    case "SELECT":
      return s.state === "choosing"
        ? { ...s, state: "selected", selectedNumber: a.number, ballOrigin: a.origin }
        : s
    case "GOTO":
      // Guarded transition so a stale timer can never fire out of order.
      return s.state === a.from ? { ...s, state: a.to } : s
    case "NEXT":
      return s.state === "revealed" ? { ...s, state: "transitioning_next" } : s
    case "ADVANCE": {
      if (s.state !== "transitioning_next") return s
      const playedCount = s.playedCount + 1
      const hasMore = playedCount < a.total
      return {
        state: hasMore ? "choosing" : "complete",
        playedCount,
        selectedNumber: null,
        ballOrigin: null,
      }
    }
    default:
      return s
  }
}

interface DgFootballRevealProps {
  tickets: Ticket[]
  settings: DemoSettings
  playSound: (cue: SoundCue) => void
  onFinish: () => void
  onHelp: () => void
}

export function DgFootballReveal({ tickets, settings, playSound, onFinish, onHelp }: DgFootballRevealProps) {
  const speed = settings.speed

  const [s, dispatch] = useReducer(reducer, undefined, () => makeInitial(settings.skipIntro))

  /* ---- active shot ----------------------------------------------------- */
  const total = tickets.length
  const activeIndex = Math.min(s.playedCount, total - 1)
  const activeTicket = tickets[activeIndex] ?? null
  const outcome = activeTicket?.outcome ?? null
  const isWin = outcome ? outcome.kind !== "none" : false
  const bigWin = outcome ? isBigWin(outcome) : false

  // Which hole the ball visibly enters. Dev override wins for staging, but the
  // OUTCOME is always the ticket's predetermined result (holes are mystery).
  const destinationHole: HoleId | null =
    settings.destination !== "auto" ? settings.destination : (activeTicket?.destinationHole ?? null)

  const shotIndex = activeIndex + 1
  const isLastShot = activeIndex + 1 >= total
  const nextShotLabel = isLastShot ? "" : `TICKET ${Math.min(activeIndex + 2, total)}`

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

  // launching → approaching_hole (destination revealed for the last stretch)
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
    const flightDur = (settings.reducedMotion ? TIMING.reducedFlightMs : TIMING.flightMs) * speed
    const lead = Math.min(TIMING.anticipationLeadMs * speed, flightDur)
    const id = window.setTimeout(() => go("approaching_hole", "entering_hole"), lead)
    return () => window.clearTimeout(id)
  }, [s.state, speed, settings.reducedMotion, go])

  // entering_hole → win_impact | nonwin_reaction
  useEffect(() => {
    if (s.state !== "entering_hole") return
    playSound("drop")
    const id = window.setTimeout(() => {
      dispatch({ type: "GOTO", from: "entering_hole", to: isWin ? "win_impact" : "nonwin_reaction" })
    }, TIMING.holeEntryMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, isWin, playSound])

  // win_impact → win_celebration
  useEffect(() => {
    if (s.state !== "win_impact") return
    playSound("impact")
    if (typeof navigator !== "undefined" && "vibrate" in navigator && settings.soundOn) {
      try {
        navigator.vibrate?.([16, 40, 22])
      } catch {
        /* best effort */
      }
    }
    const id = window.setTimeout(() => go("win_impact", "win_celebration"), TIMING.winImpactMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, settings.soundOn, go, playSound])

  // win_celebration → revealing
  useEffect(() => {
    if (s.state !== "win_celebration") return
    playSound("prize")
    const dur = (TIMING.scoredTakeoverMs + (bigWin ? TIMING.topPrizeExtraMs : 0)) * speed
    const id = window.setTimeout(() => go("win_celebration", "revealing"), dur)
    return () => window.clearTimeout(id)
  }, [s.state, speed, bigWin, go, playSound])

  // nonwin_reaction → revealing
  useEffect(() => {
    if (s.state !== "nonwin_reaction") return
    playSound("nowin")
    const id = window.setTimeout(() => go("nonwin_reaction", "revealing"), TIMING.nonwinHoldMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, go, playSound])

  // revealing → revealed (panel finished rising; wait for the customer)
  useEffect(() => {
    if (s.state !== "revealing") return
    const id = window.setTimeout(() => go("revealing", "revealed"), TIMING.panelRiseMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, go])

  // transitioning_next → choosing | complete
  useEffect(() => {
    if (s.state !== "transitioning_next") return
    const id = window.setTimeout(() => dispatch({ type: "ADVANCE", total }), TIMING.reflowMs * speed)
    return () => window.clearTimeout(id)
  }, [s.state, speed, total])

  /* ---- callbacks ------------------------------------------------------- */
  const onSelectBall = useCallback((n: number, origin: { x: number; y: number }) => {
    dispatch({ type: "SELECT", number: n, origin })
  }, [])
  const onNext = useCallback(() => dispatch({ type: "NEXT" }), [])

  /* ---- run summary ----------------------------------------------------- */
  const summary: RunSummary = useMemo(() => {
    let instantWins = 0
    let cashPence = 0
    let creditPence = 0
    for (const t of tickets) {
      const o = t.outcome
      if (o.kind !== "none") instantWins += 1
      if (o.kind === "cash") cashPence += o.amountPence
      if (o.kind === "credit") creditPence += o.amountPence
    }
    return { totalShots: tickets.length, instantWins, cashPence, creditPence }
  }, [tickets])

  const revealVisible = s.state === "revealing" || s.state === "revealed"
  const revealCopy = outcome ? revealCopyFor(outcome) : null

  return (
    <div className="dgf-reveal-root">
      <DgFootballStage
        state={s.state}
        settings={settings}
        destinationHole={destinationHole}
        isWin={isWin}
        ballOrigin={s.ballOrigin}
        shotIndex={shotIndex}
        shotTotal={total}
        nextShotLabel={nextShotLabel}
        isLastShot={isLastShot}
        selectedNumber={s.selectedNumber}
        revealCopy={revealCopy}
        revealVisible={revealVisible}
        summary={summary}
        summaryVisible={s.state === "complete"}
        onSelectBall={onSelectBall}
        onNext={onNext}
        onFinish={onFinish}
        onHelp={onHelp}
      />

      {/* Live region for the result (screen-reader announcement). */}
      <div className="sr-only" role="status" aria-live="polite">
        {s.state === "revealed" && revealCopy
          ? `${revealCopy.eyebrow} ${revealCopy.amount} ${revealCopy.unit}. ${revealCopy.support}.`
          : s.state === "complete"
            ? `All shots complete. ${summary.instantWins} instant wins.`
            : ""}
      </div>
    </div>
  )
}
