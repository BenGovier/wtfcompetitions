"use client"

/**
 * DgFootballReveal — the orchestrator. Holds the single typed GameState in a
 * reducer (no scattered booleans), advances through the mock tickets, and
 * renders the Stage + PrizeReveal + SummaryPanel. All outcomes are
 * predetermined mock data; the interaction is presentation only.
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { DemoSettings, GameState, SoundCue, Ticket } from "./types"
import { revealCopyFor, TIMING } from "./config"
import { DgFootballStage } from "./DgFootballStage"
import { PrizeReveal, SummaryPanel, type RunSummary } from "./PrizeReveal"

interface RevealStateShape {
  state: GameState
  activeId: string | null
  playedIds: string[]
}

type Action =
  | { type: "INTRO_DONE" }
  | { type: "SELECT"; id: string }
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
      return s.state === "choosing" ? { ...s, state: "selected", activeId: a.id } : s
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
    case "NEXT": {
      if (s.state !== "revealed" || !s.activeId) return s
      return { state: "next_ticket", activeId: null, playedIds: [...s.playedIds, s.activeId] }
    }
    case "ADVANCE":
      if (s.state !== "next_ticket") return s
      return { ...s, state: a.hasMore ? "choosing" : "complete" }
    case "RESET":
      return { state: a.skipIntro ? "choosing" : "intro", activeId: null, playedIds: [] }
    default:
      return s
  }
}

interface DgFootballRevealProps {
  tickets: Ticket[]
  settings: DemoSettings
  playSound: (cue: SoundCue) => void
  onFinish: () => void
}

export function DgFootballReveal({ tickets, settings, playSound, onFinish }: DgFootballRevealProps) {
  const slow = settings.slowMotion ? 3 : 1

  const [s, dispatch] = useReducer(reducer, undefined, () => ({
    state: settings.skipIntro ? ("choosing" as GameState) : ("intro" as GameState),
    activeId: null,
    playedIds: [] as string[],
  }))

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === s.activeId) ?? null,
    [tickets, s.activeId],
  )
  const playedSet = useMemo(() => new Set(s.playedIds), [s.playedIds])

  const shotTotal = tickets.length
  const shotCurrent = Math.min(shotTotal, s.playedIds.length + 1)

  const compact = settings.ticketCount >= 10

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
    const remaining = tickets.filter((t) => !playedSet.has(t.id)).length
    const id = window.setTimeout(
      () => dispatch({ type: "ADVANCE", hasMore: remaining > 0 }),
      TIMING.reflowMs * slow,
    )
    return () => window.clearTimeout(id)
  }, [s.state, tickets, playedSet, slow])

  /* ---- callbacks down to the stage ------------------------------------ */
  const onSelectBall = useCallback(
    (t: Ticket) => {
      playSound("select")
      dispatch({ type: "SELECT", id: t.id })
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
  const summary: RunSummary = useMemo(() => {
    const played = tickets.filter((t) => playedSet.has(t.id))
    let instantWins = 0
    let cashPence = 0
    let creditPence = 0
    for (const t of played) {
      const o = t.outcome
      if (o.kind !== "none") instantWins += 1
      if (o.kind === "cash") cashPence += o.amountPence
      if (o.kind === "credit") creditPence += o.amountPence
    }
    return { totalShots: tickets.length, instantWins, cashPence, creditPence }
  }, [tickets, playedSet])

  const revealVisible = s.state === "revealing" || s.state === "revealed"
  const revealCopy = activeTicket ? revealCopyFor(activeTicket.outcome) : null
  const isLastShot = s.playedIds.length + 1 >= tickets.length

  return (
    <div className="dgf-reveal-root">
      <DgFootballStage
        state={s.state}
        activeTicket={activeTicket}
        tickets={tickets}
        playedIds={playedSet}
        settings={settings}
        shotCurrent={shotCurrent}
        shotTotal={shotTotal}
        compact={compact}
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
          shotLabel={isLastShot ? "FINAL SHOT" : `SHOT ${shotCurrent} OF ${shotTotal}`}
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
