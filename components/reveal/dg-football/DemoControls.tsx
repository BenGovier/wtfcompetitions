"use client"

/**
 * DemoControls — development-only control panel for the /dgfootballidea
 * prototype. Lets a designer force outcomes, ticket counts and rendering
 * options. These controls never touch production code paths — they only drive
 * this isolated demo's local state.
 */

import type { DemoSettings, OutcomePreset, TicketCount } from "./types"
import { OUTCOME_PRESET_OPTIONS, TICKET_COUNT_OPTIONS } from "./config"

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
        <legend>Options</legend>
        <div className="dgf-ctl-toggles">
          <Toggle label="Skip intro" checked={settings.skipIntro} onChange={(v) => onChange({ skipIntro: v })} />
          <Toggle label="Sound on" checked={settings.soundOn} onChange={(v) => onChange({ soundOn: v })} />
          <Toggle
            label="Reduced motion"
            checked={settings.reducedMotion}
            onChange={(v) => onChange({ reducedMotion: v })}
          />
          <Toggle label="Slow animation" checked={settings.slowMotion} onChange={(v) => onChange({ slowMotion: v })} />
        </div>
      </fieldset>

      <fieldset className="dgf-ctl-group">
        <legend>Debug overlays</legend>
        <div className="dgf-ctl-toggles">
          <Toggle
            label="Mouth target"
            checked={settings.showMouthTarget}
            onChange={(v) => onChange({ showMouthTarget: v })}
          />
          <Toggle
            label="Image bounding box"
            checked={settings.showImageBounds}
            onChange={(v) => onChange({ showImageBounds: v })}
          />
          <Toggle
            label="Ball endpoint"
            checked={settings.showEndpoint}
            onChange={(v) => onChange({ showEndpoint: v })}
          />
          <Toggle
            label="Viewport centre"
            checked={settings.showViewportCentre}
            onChange={(v) => onChange({ showViewportCentre: v })}
          />
          <Toggle
            label="Animation state"
            checked={settings.showAnimState}
            onChange={(v) => onChange({ showAnimState: v })}
          />
        </div>
      </fieldset>

      <button type="button" className="dgf-ctl-reset" onClick={onReset}>
        Reset experience
      </button>
    </div>
  )
}
