"use client"

/**
 * DgFootballReveal — the orchestrator.
 *
 * CORRECT INTERACTION MODEL (do not regress):
 *  - `tickets` is the PURCHASED-TICKET reveal queue. Its length is the total
 *    number of shots (1 → hundreds). It is supplied via props / reveal data.
 *  - There are always exactly FIVE reusable footballs. The customer picks one
 *    football per shot; that choice is PRESENTATION ONLY and never decides the
 *    result. The result for shot N is `tickets[N].outcome`, predetermined.
 *  - After each shot the five footballs reset for the next shot.
 *
 * State is a single typed reducer keyed on:
 *    currentRevealIndex  — which ticket in the queue we are revealing
 *    selectedBallIndex   — which of the five footballs is chosen (visual only)
 *    (game phase)        — choosing → selected → aiming → launched → impact →
 *                          revealing → revealed → next_ticket → complete
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { DemoSettings, GameState, SoundCue, Ticket } from "./types"
import { BALL_COUNT, revealCopyFor, TIMING } from "./config"
import { DgFootballStage } from "./DgFootballStage"
import { PrizeReveal, SummaryPanel, type RunSummary } from "./PrizeReveal"

interface RevealStateShape {
  state: GameState
  /** Index into the reveal queue (0-based). */
  currentRevealIndex: number
  /** Chosen football for the current shot (0-based), or null. Visual only. */
  selectedBallIndex: number | null
}

type Action =
  | { type: "INTRO_DONE" }
  | { type: "SELECT"; ballIndex: number }
  | { type: "AIM_START" }
  | { type: "AIM_CANCEL" }
  | { type: "LAUNCH" }
  | { type: "IMPACT" }
  | { type: "IMPACT_COMPLETE" }
  | { type: "REVEALED" }
  | { type: "NEXT" }
  | { type: "ADVANCE"; hasMore: boolean }
  | { type: "RESET"; skipIntro: boolean }

function reducer(s: RevealStateShape, a: Action): RevealStateShape {
  switch (a.type) {
    case "INTRO_DONE":
      return s.state === "intro" ? { ...s, state: "choosing" } : s
    case "SELECT":
      // Guard: only choose from the choosing state (prevents double-select).
      return s.state === "choosing"
        ? { ...s, state: "selected", selectedBallIndex: a.ballIndex }
        : s
    case "AIM_START":
      return s.state === "selected" ? { ...s, state: "aiming" } : s
    case "AIM_CANCEL":
      return s.state === "aiming" ? { ...s, state: "selected" } : s
    case "LAUNCH":
      // Guard: block duplicate launches.
      return s.state === "selected" || s.state === "aiming" ? { ...s, state: "launched" } : s
    case "IMPACT":
      return s.state === "launched" ? { ...s, state: "impact" } : s
    case "IMPACT_COMPLETE":
      // Guard: never reset/reveal twice during impact.
      return s.state === "impact" ? { ...s, state: "revealing" } : s
    case "REVEALED":
      return s.state === "revealing" ? { ...s, state: "revealed" } : s
    case "NEXT":
      return s.state === "revealed" ? { ...s, state: "next_ticket" } : s
    case "ADVANCE":
      if (s.state !== "next_ticket") return s
      // Advance the reveal queue and RESET the five ball choices for the next
      // shot so no previous selection carries over.
      return a.hasMore
        ? {
            state: "choosing",
            currentRevealIndex: s.currentRevealIndex + 1,
            selectedBallIndex: null,
          }
        : { ...s, state: "complete" }
    case "RESET":
      return {
        state: a.skipIntro ? "choosing" : "intro",
        currentRevealIndex: 0,
        selectedBallIndex: null,
      }
    default:
      return s
  }
}

interface DgFootballRevealProps {
  /** The predetermined reveal queue = one entry per purchased ticket. */
  tickets: Ticket[]
  settings: DemoSettings
  playSound: (cue: SoundCue) => void
  onFinish: () => void
}

export function DgFootballReveal({ tickets, settings, playSound, onFinish }: DgFootballRevealProps) {
  const slow = settings.slowMotion ? 3 : 1

  const [s, dispatch] = useReducer(reducer, undefined, () => ({
    state: settings.skipIntro ? ("choosing" as GameState) : ("intro" as GameState),
    currentRevealIndex: 0,
    selectedBallIndex: null,
  }))

  /* ---- reveal-queue derived values ------------------------------------ */
  const totalRevealCount = tickets.length
  const currentRevealIndex = Math.min(s.currentRevealIndex, Math.max(0, totalRevealCount - 1))
  const activeTicket = tickets[currentRevealIndex] ?? null

  // 1-based shot numbers driven entirely by the reveal queue (dynamic total).
  const shotCurrent = currentRevealIndex + 1
  const shotTotal = totalRevealCount
  // Is the ticket currently being revealed the final one in the queue?
  const isLastShot = currentRevealIndex + 1 >= totalRevealCount
  // The shot the NEXT-SHOT button is about to open (only meaningful if !isLast).
  const nextRevealNumber = currentRevealIndex + 2

  /* ---- intro auto-advance --------------------------------------------- */
  useEffect(() => {
    if (s.state !== "intro") return
    const id = window.setTimeout(() => dispatch({ type: "INTRO_DONE" }), TIMING.introMs * slow)
    return () => window.clearTimeout(id)
  }, [s.state, slow])

  /* ---- revealing -> revealed after the panel rises -------------------- */
  useEffect(() => {
    if (s.state !== "revealing") return
    playSound(activeTicket && activeTicket.outcome.kind !== "none" ? "prize" : "nowin")
    const id = window.setTimeout(() => dispatch({ type: "REVEALED" }), TIMING.panelRiseMs * slow)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.state, slow])

  /* ---- next_ticket -> choosing/complete after reflow ------------------ */
  useEffect(() => {
    if (s.state !== "next_ticket") return
    const hasMore = s.currentRevealIndex + 1 < totalRevealCount
    const id = window.setTimeout(
      () => dispatch({ type: "ADVANCE", hasMore }),
      TIMING.reflowMs * slow,
    )
    return () => window.clearTimeout(id)
  }, [s.state, s.currentRevealIndex, totalRevealCount, slow])

  /* ---- callbacks down to the stage ------------------------------------ */
  const onSelectBall = useCallback(
    (ballIndex: number) => {
      playSound("select")
      dispatch({ type: "SELECT", ballIndex })
    },
    [playSound],
  )
  const onAimStart = useCallback(() => dispatch({ type: "AIM_START" }), [])
  const onAimCancel = useCallback(() => dispatch({ type: "AIM_CANCEL" }), [])
  const onLaunch = useCallback(() => dispatch({ type: "LAUNCH" }), [])
  const onImpact = useCallback(() => dispatch({ type: "IMPACT" }), [])
  const onImpactComplete = useCallback(() => dispatch({ type: "IMPACT_COMPLETE" }), [])
  const onNext = useCallback(() => dispatch({ type: "NEXT" }), [])

  /* ---- run summary ----------------------------------------------------- */
  // Reaching "complete" means every ticket in the queue was revealed in order.
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
  const revealCopy = activeTicket ? revealCopyFor(activeTicket.outcome) : null

  return (
    <div className="dgf-reveal-root">
      <DgFootballStage
        state={s.state}
        ballCount={BALL_COUNT}
        selectedBallIndex={s.selectedBallIndex}
        settings={settings}
        shotCurrent={shotCurrent}
        shotTotal={shotTotal}
        onSelectBall={onSelectBall}
        onAimStart={onAimStart}
        onAimCancel={onAimCancel}
        onLaunch={onLaunch}
        onImpact={onImpact}
        onImpactComplete={onImpactComplete}
        playSound={playSound}
      />

      {/* Live region for the result (screen-reader announcement). */}
      <div className="sr-only" role="status" aria-live="polite">
        {s.state === "revealed" && revealCopy
          ? `${revealCopy.eyebrow} ${revealCopy.value}. ${revealCopy.support}.`
          : s.state === "complete"
            ? `All shots complete. ${summary.instantWins} instant wins.`
            : ""}
      </div>

      {revealCopy && (
        <PrizeReveal
          copy={revealCopy}
          visible={revealVisible}
          reducedMotion={settings.reducedMotion}
          slowFactor={slow}
          isLast={isLastShot}
          shotLabel={`SHOT ${nextRevealNumber} OF ${shotTotal}`}
          onNext={onNext}
        />
      )}

      <SummaryPanel
        summary={summary}
        visible={s.state === "complete"}
        reducedMotion={settings.reducedMotion}
        slowFactor={slow}
        onFinish={onFinish}
      />
    </div>
  )
}
