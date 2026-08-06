"use client"

/**
 * DgFootballReveal — the orchestrator and single source of truth for game phase.
 *
 * INTERACTION MODEL (per the refinement spec — do not regress):
 *  - `tickets` is the purchased-ticket list. Each ticket is ONE shot and shows
 *    as ONE numbered football (#1..#N) in the tray. The signature demo is five
 *    tickets = five footballs.
 *  - The customer picks a numbered football to shoot. That ticket's outcome is
 *    PREDETERMINED (`tickets[n-1].outcome`); the pick never decides the result.
 *  - After a shot the used football visibly LEAVES the tray and the remaining
 *    footballs slide inward. "SHOT X OF Y" tracks tickets played.
 *
 * Phase is a single typed reducer:
 *   intro → choosing → selected → aiming → launching → pre_impact → impact →
 *   suspense → revealing → revealed → transitioning_next → (choosing | complete)
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { DemoSettings, GameState, SoundCue, Ticket } from "./types"
import { revealCopyFor, TIMING } from "./config"
import { DgFootballStage } from "./DgFootballStage"
import { PrizeReveal, SummaryPanel, type RunSummary } from "./PrizeReveal"

interface RevealStateShape {
  state: GameState
  /** Per-ticket "played" flags (index = ticket index). */
  played: boolean[]
  /** 1-based ball number chosen for the CURRENT shot (= ticket index + 1). */
  selectedNumber: number | null
  /** Ball number leaving the tray during the next-shot transition. */
  leavingNumber: number | null
}

type Action =
  | { type: "INTRO_DONE" }
  | { type: "SELECT"; number: number }
  | { type: "AIM_START" }
  | { type: "AIM_CANCEL" }
  | { type: "LAUNCH" }
  | { type: "PRE_IMPACT" }
  | { type: "IMPACT" }
  | { type: "SUSPENSE" }
  | { type: "REVEAL" }
  | { type: "REVEALED" }
  | { type: "NEXT" }
  | { type: "ADVANCE" }

function makeInitial(ticketCount: number, skipIntro: boolean): RevealStateShape {
  return {
    state: skipIntro ? "choosing" : "intro",
    played: Array.from({ length: ticketCount }, () => false),
    selectedNumber: null,
    leavingNumber: null,
  }
}

function reducer(s: RevealStateShape, a: Action): RevealStateShape {
  switch (a.type) {
    case "INTRO_DONE":
      return s.state === "intro" ? { ...s, state: "choosing" } : s
    case "SELECT":
      // Guard: only choose from the choosing phase (prevents double-select).
      return s.state === "choosing" ? { ...s, state: "selected", selectedNumber: a.number } : s
    case "AIM_START":
      return s.state === "selected" ? { ...s, state: "aiming" } : s
    case "AIM_CANCEL":
      return s.state === "aiming" ? { ...s, state: "selected" } : s
    case "LAUNCH":
      // Guard: block duplicate launches.
      return s.state === "selected" || s.state === "aiming" ? { ...s, state: "launching" } : s
    case "PRE_IMPACT":
      return s.state === "launching" ? { ...s, state: "pre_impact" } : s
    case "IMPACT":
      // Accept from launching or pre_impact (pre_impact is a short visual beat).
      return s.state === "launching" || s.state === "pre_impact" ? { ...s, state: "impact" } : s
    case "SUSPENSE":
      return s.state === "impact" ? { ...s, state: "suspense" } : s
    case "REVEAL":
      return s.state === "suspense" ? { ...s, state: "revealing" } : s
    case "REVEALED":
      return s.state === "revealing" ? { ...s, state: "revealed" } : s
    case "NEXT":
      // Begin the transition: mark the current ball as leaving the tray.
      return s.state === "revealed"
        ? { ...s, state: "transitioning_next", leavingNumber: s.selectedNumber }
        : s
    case "ADVANCE": {
      if (s.state !== "transitioning_next") return s
      // Commit the played ticket, then either reset for the next shot or finish.
      const played = s.played.slice()
      if (s.selectedNumber != null) played[s.selectedNumber - 1] = true
      const hasMore = played.some((p) => !p)
      return hasMore
        ? { state: "choosing", played, selectedNumber: null, leavingNumber: null }
        : { state: "complete", played, selectedNumber: null, leavingNumber: null }
    }
    default:
      return s
  }
}

interface DgFootballRevealProps {
  /** The predetermined ticket list = one numbered football per ticket. */
  tickets: Ticket[]
  settings: DemoSettings
  playSound: (cue: SoundCue) => void
  onFinish: () => void
}

export function DgFootballReveal({ tickets, settings, playSound, onFinish }: DgFootballRevealProps) {
  const slow = settings.slowMotion ? 3 : 1

  const [s, dispatch] = useReducer(reducer, undefined, () =>
    makeInitial(tickets.length, settings.skipIntro),
  )

  /* ---- derived values -------------------------------------------------- */
  const total = tickets.length
  const playedCount = s.played.filter(Boolean).length
  // Remaining ball numbers (1-based) in tray order.
  const remainingNumbers = useMemo(
    () => s.played.map((p, i) => (p ? -1 : i + 1)).filter((n) => n > 0),
    [s.played],
  )
  const activeTicketIndex = s.selectedNumber != null ? s.selectedNumber - 1 : null
  const activeTicket = activeTicketIndex != null ? (tickets[activeTicketIndex] ?? null) : null

  // 1-based shot number for the shot in progress / just revealed.
  const shotCurrent = Math.min(playedCount + 1, total)
  const shotTotal = total
  // Is this the final remaining ticket?
  const isLastShot = playedCount + 1 >= total
  const nextShotNumber = Math.min(playedCount + 2, total)

  /* ---- intro auto-advance --------------------------------------------- */
  useEffect(() => {
    if (s.state !== "intro") return
    const id = window.setTimeout(() => dispatch({ type: "INTRO_DONE" }), TIMING.introMs * slow)
    return () => window.clearTimeout(id)
  }, [s.state, slow])

  /* ---- impact → suspense → revealing → revealed ----------------------- */
  useEffect(() => {
    if (s.state !== "impact") return
    const id = window.setTimeout(() => dispatch({ type: "SUSPENSE" }), TIMING.impactMs * slow)
    return () => window.clearTimeout(id)
  }, [s.state, slow])

  useEffect(() => {
    if (s.state !== "suspense") return
    const id = window.setTimeout(() => dispatch({ type: "REVEAL" }), TIMING.suspenseMs * slow)
    return () => window.clearTimeout(id)
  }, [s.state, slow])

  useEffect(() => {
    if (s.state !== "revealing") return
    playSound(activeTicket && activeTicket.outcome.kind !== "none" ? "prize" : "nowin")
    const id = window.setTimeout(() => dispatch({ type: "REVEALED" }), TIMING.panelRiseMs * slow)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.state, slow])

  /* ---- transitioning_next → choosing / complete after reflow ---------- */
  useEffect(() => {
    if (s.state !== "transitioning_next") return
    const id = window.setTimeout(() => dispatch({ type: "ADVANCE" }), TIMING.reflowMs * slow)
    return () => window.clearTimeout(id)
  }, [s.state, slow])

  /* ---- callbacks down to the stage ------------------------------------ */
  const onSelectBall = useCallback(
    (n: number) => {
      playSound("select")
      dispatch({ type: "SELECT", number: n })
    },
    [playSound],
  )
  const onAimStart = useCallback(() => dispatch({ type: "AIM_START" }), [])
  const onAimCancel = useCallback(() => dispatch({ type: "AIM_CANCEL" }), [])
  const onLaunch = useCallback(() => dispatch({ type: "LAUNCH" }), [])
  const onPreImpact = useCallback(() => dispatch({ type: "PRE_IMPACT" }), [])
  const onImpact = useCallback(() => dispatch({ type: "IMPACT" }), [])
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
  const revealCopy = activeTicket ? revealCopyFor(activeTicket.outcome) : null

  return (
    <div className="dgf-reveal-root">
      <DgFootballStage
        state={s.state}
        remainingNumbers={remainingNumbers}
        selectedNumber={s.selectedNumber}
        leavingNumber={s.leavingNumber}
        settings={settings}
        shotCurrent={shotCurrent}
        shotTotal={shotTotal}
        onSelectBall={onSelectBall}
        onAimStart={onAimStart}
        onAimCancel={onAimCancel}
        onLaunch={onLaunch}
        onPreImpact={onPreImpact}
        onImpact={onImpact}
        playSound={playSound}
      />

      {/* Live region for the result (screen-reader announcement). */}
      <div className="sr-only" role="status" aria-live="polite">
        {s.state === "revealed" && revealCopy
          ? `${revealCopy.eyebrow} ${revealCopy.amount} ${revealCopy.unit}. ${revealCopy.support}.`
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
          shotIndex={shotCurrent}
          shotTotal={shotTotal}
          shotLabel={`SHOT ${nextShotNumber} OF ${shotTotal}`}
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
