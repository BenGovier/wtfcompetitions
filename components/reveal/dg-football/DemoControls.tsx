"use client"

/**
 * DemoControls — development-only control panel for the /dgfootballidea
 * prototype. Lets a designer force outcomes, ticket counts, shot paths and
 * rendering options, plus static character-pose previews and alignment
 * overlays. These controls never touch production code paths — they only drive
 * this isolated demo's local state.
 */

import type {
  CharPreview,
  DemoSettings,
  OutcomePreset,
  ShotPath,
  TicketCount,
  TimeScale,
} from "./types"
import {
  CHAR_PREVIEW_OPTIONS,
  OUTCOME_PRESET_OPTIONS,
  SHOT_PATH_OPTIONS,
  TICKET_COUNT_OPTIONS,
  TIME_SCALE_OPTIONS,
} from "./config"

interface DemoControlsProps {
  settings: DemoSettings
  onChange: (patch: Partial<DemoSettings>) => void
  onReset: () => void
  variant: "sidebar" | "sheet"
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="dgf-ctl-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dgf-ctl-track" aria-hidden="true">
        <span className="dgf-ctl-thumb" />
      </span>
      <span className="dgf-ctl-toggle-label">{label}</span>
    </label>
  )
}

export function DemoControls({ settings, onChange, onReset, variant }: DemoControlsProps) {
  return (
    <div className={`dgf-controls dgf-controls-${variant}`}>
      <div className="dgf-ctl-head">
        <span className="dgf-ctl-title">DEMO CONTROLS</span>
        <span className="dgf-ctl-badge">DEV ONLY</span>
      </div>

      <fieldset className="dgf-ctl-group">
        <legend>Outcome preset</legend>
        <div className="dgf-ctl-chips">
          {OUTCOME_PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dgf-chip ${settings.preset === opt.value ? "dgf-chip-on" : ""}`}
              onClick={() => onChange({ preset: opt.value as OutcomePreset })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Ticket count</legend>
        <div className="dgf-ctl-chips">
          {TICKET_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`dgf-chip ${settings.ticketCount === n ? "dgf-chip-on" : ""}`}
              onClick={() => onChange({ ticketCount: n as TicketCount })}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Shot path</legend>
        <div className="dgf-ctl-chips">
          {SHOT_PATH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dgf-chip ${settings.shotPath === opt.value ? "dgf-chip-on" : ""}`}
              onClick={() => onChange({ shotPath: opt.value as ShotPath })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="dgf-ctl-note">Forces the flight regardless of the outcome (win still shows the winning prize).</p>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Time scale</legend>
        <div className="dgf-ctl-chips">
          {TIME_SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dgf-chip ${settings.timeScale === opt.value ? "dgf-chip-on" : ""}`}
              onClick={() => onChange({ timeScale: opt.value as TimeScale })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Character preview</legend>
        <div className="dgf-ctl-chips">
          {CHAR_PREVIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dgf-chip ${settings.charPreview === opt.value ? "dgf-chip-on" : ""}`}
              onClick={() => onChange({ charPreview: opt.value as CharPreview })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="dgf-ctl-note">Freezes DG on a single pose so you can inspect each asset&apos;s framing.</p>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Options</legend>
        <div className="dgf-ctl-toggles">
          <Toggle label="Skip intro" checked={settings.skipIntro} onChange={(v) => onChange({ skipIntro: v })} />
          <Toggle label="Sound on" checked={settings.soundOn} onChange={(v) => onChange({ soundOn: v })} />
          <Toggle
            label="Reduced motion"
            checked={settings.reducedMotion}
            onChange={(v) => onChange({ reducedMotion: v })}
          />
        </div>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Debug overlays</legend>
        <div className="dgf-ctl-toggles">
          <Toggle
            label="Mouth target point"
            checked={settings.showMouthTarget}
            onChange={(v) => onChange({ showMouthTarget: v })}
          />
          <Toggle
            label="Mouth entry mask"
            checked={settings.showMouthMask}
            onChange={(v) => onChange({ showMouthMask: v })}
          />
          <Toggle
            label="Character bounds"
            checked={settings.showCharBounds}
            onChange={(v) => onChange({ showCharBounds: v })}
          />
          <Toggle
            label="Scored image bounds"
            checked={settings.showScoredBounds}
            onChange={(v) => onChange({ showScoredBounds: v })}
          />
          <Toggle
            label="Prize safe-area"
            checked={settings.showPrizeSafe}
            onChange={(v) => onChange({ showPrizeSafe: v })}
          />
          <Toggle
            label="Ball endpoint"
            checked={settings.showEndpoint}
            onChange={(v) => onChange({ showEndpoint: v })}
          />
          <Toggle label="Animation state" checked={settings.showState} onChange={(v) => onChange({ showState: v })} />
        </div>
      </fieldset>

      <button type="button" className="dgf-ctl-reset" onClick={onReset}>
        Reset experience
      </button>
    </div>
  )
}
