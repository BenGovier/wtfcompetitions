"use client"

/**
 * DgFootballDemo — top-level wrapper for the isolated /dgfootballidea prototype.
 * Owns the dev DemoSettings, builds deterministic mock tickets, frames the game
 * in a portrait viewport (centred on desktop, full-bleed on mobile), shows the
 * landscape rotate prompt, and provides an optional self-contained sound synth
 * (no external audio files, never autoplays before a user gesture).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DemoSettings, SoundCue } from "./types"
import { buildTickets, DEFAULT_SETTINGS } from "./config"
import { DgFootballReveal } from "./DgFootballReveal"
import { DemoControls } from "./DemoControls"

/* -------------------------------------------------------------------------- */
/*  Minimal WebAudio sound synth (conceptual cues, no asset files)            */
/* -------------------------------------------------------------------------- */
const CUE_TONE: Record<SoundCue, { freq: number; dur: number; type: OscillatorType }> = {
  select: { freq: 520, dur: 0.08, type: "triangle" },
  charge: { freq: 320, dur: 0.12, type: "sawtooth" },
  launch: { freq: 180, dur: 0.18, type: "sawtooth" },
  impact: { freq: 90, dur: 0.22, type: "square" },
  prize: { freq: 720, dur: 0.35, type: "triangle" },
  nowin: { freq: 440, dur: 0.22, type: "sine" },
}

function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      try {
        ctxRef.current = new Ctor()
      } catch {
        return null
      }
    }
    return ctxRef.current
  }, [])

  const play = useCallback(
    (cue: SoundCue) => {
      if (!enabled) return
      const ctx = ensureCtx()
      if (!ctx) return
      if (ctx.state === "suspended") void ctx.resume()
      const { freq, dur, type } = CUE_TONE[cue]
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now)
      if (cue === "prize") osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + dur)
      if (cue === "launch") osc.frequency.exponentialRampToValueAtTime(freq * 2.4, now + dur)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + dur + 0.02)
    },
    [enabled, ensureCtx],
  )

  useEffect(() => {
    return () => {
      void ctxRef.current?.close().catch(() => {})
    }
  }, [])

  return play
}

/* -------------------------------------------------------------------------- */
/*  Orientation                                                               */
/* -------------------------------------------------------------------------- */
function useIsLandscape() {
  const [landscape, setLandscape] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 560px)")
    const update = () => setLandscape(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return landscape
}

/* -------------------------------------------------------------------------- */

export function DgFootballDemo() {
  const [settings, setSettings] = useState<DemoSettings>(DEFAULT_SETTINGS)
  const [runNonce, setRunNonce] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  const play = useSound(settings.soundOn)
  const landscape = useIsLandscape()

  // Respect the OS reduced-motion setting as the initial default.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) setSettings((s) => ({ ...s, reducedMotion: true }))
  }, [])

  const tickets = useMemo(
    () => buildTickets(settings.preset, settings.ticketCount),
    [settings.preset, settings.ticketCount],
  )

  const patch = useCallback((p: Partial<DemoSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...p }
      return next
    })
    // Changing the outcome/ticket config restarts the run.
    if (p.preset !== undefined || p.ticketCount !== undefined || p.skipIntro !== undefined) {
      setRunNonce((n) => n + 1)
    }
  }, [])

  const resetExperience = useCallback(() => {
    setRunNonce((n) => n + 1)
    setSheetOpen(false)
  }, [])

  const handleFinish = useCallback(() => {
    setRunNonce((n) => n + 1)
  }, [])

  // Remount key: rebuild the whole run when config changes or on reset.
  const runKey = `${settings.preset}-${settings.ticketCount}-${settings.skipIntro}-${runNonce}`

  return (
    <div className="dgf-page">
      <div className="dgf-desktop-bg" aria-hidden="true" />

      <div className="dgf-layout">
        {/* Portrait game viewport */}
        <div className="dgf-viewport">
          <DgFootballReveal key={runKey} tickets={tickets} settings={settings} playSound={play} onFinish={handleFinish} />

          {/* Sound toggle (top-right, unobtrusive) */}
          <button
            type="button"
            className="dgf-sound-toggle"
            aria-pressed={settings.soundOn}
            aria-label={settings.soundOn ? "Turn sound off" : "Turn sound on"}
            onClick={() => patch({ soundOn: !settings.soundOn })}
          >
            {settings.soundOn ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                <path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                <path d="M17 9l5 6M22 9l-5 6" />
              </svg>
            )}
          </button>

          {/* Landscape rotate prompt */}
          {landscape && (
            <div className="dgf-rotate" role="alertdialog" aria-label="Please rotate your phone">
              <div className="dgf-rotate-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <path d="M2 12a10 10 0 0 1 10-10" />
                </svg>
              </div>
              <p className="dgf-rotate-title">ROTATE YOUR PHONE</p>
              <p className="dgf-rotate-sub">DG&apos;S BIG BALLERS IS BEST PLAYED IN PORTRAIT</p>
            </div>
          )}
        </div>

        {/* Desktop-side dev panel */}
        <aside className="dgf-side-controls">
          <DemoControls settings={settings} onChange={patch} onReset={resetExperience} variant="sidebar" />
        </aside>
      </div>

      {/* Mobile controls trigger + sheet */}
      <button type="button" className="dgf-controls-trigger" onClick={() => setSheetOpen(true)}>
        DEMO CONTROLS
      </button>
      {sheetOpen && (
        <div className="dgf-sheet-scrim" onClick={() => setSheetOpen(false)}>
          <div className="dgf-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Demo controls">
            <button type="button" className="dgf-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Close demo controls">
              ✕
            </button>
            <DemoControls settings={settings} onChange={patch} onReset={resetExperience} variant="sheet" />
          </div>
        </div>
      )}
    </div>
  )
}
