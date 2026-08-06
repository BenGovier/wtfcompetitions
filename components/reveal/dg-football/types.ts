/**
 * DG'S BIG BALLERS — shared types for the isolated /dgfootballidea prototype.
 *
 * PROTOTYPE ONLY. No Supabase, no checkout, no payments, no award allocation,
 * no API routes. Every value here is mock/presentation data.
 */

/**
 * The single, typed game state. Never model this with loose booleans.
 *
 * The flight branches after `launching`:
 *   WIN:  launching → winning_entry → win_impact →
 *         win_celebration_transition → win_celebration → suspense →
 *         revealing → revealed
 *   MISS: launching → miss_flight → miss_reaction → suspense →
 *         revealing → revealed
 * Both branches converge at `suspense`, then continue to
 *   revealed → transitioning_next → (choosing | complete).
 */
export type GameState =
  | "intro"
  | "choosing"
  | "selected"
  | "aiming"
  | "launching"
  | "winning_entry"
  | "miss_flight"
  | "win_impact"
  | "win_celebration_transition"
  | "win_celebration"
  | "miss_reaction"
  | "suspense"
  | "revealing"
  | "revealed"
  | "transitioning_next"
  | "complete"

/** Which supplied photo DG is showing. Derived from GameState — never ad-hoc. */
export type CharacterPose = "mouth_open" | "neutral" | "scored"

/** Deterministic miss trajectories. Fixed per shot — never randomised. */
export type MissVariant = "left_cheek" | "right_cheek" | "top" | "edge_clip" | "shoulder_bounce"

/** Dev "shot path" override. `auto` derives win/miss from the ticket outcome. */
export type ShotPath = "auto" | "score" | MissVariant

/** Dev static character preview (inspect a single asset), or "off" for live. */
export type CharPreview = "off" | "mouth_open" | "neutral" | "scored"

/** Dev timing multiplier: 1 = normal, 2 = 0.5×, 4 = 0.25×. */
export type TimeScale = 1 | 2 | 4

/** The kind of instant-win outcome for a single ticket. */
export type OutcomeKind = "none" | "credit" | "cash" | "mystery"

/** A single deterministic mock outcome. `amountPence` is only meaningful for
 *  cash / credit outcomes. Never exposed to the UI before impact. */
export interface Outcome {
  kind: OutcomeKind
  /** Whole-pound value in pence for cash/credit, else 0. */
  amountPence: number
}

/** A mock ticket = one shot = one football. */
export interface Ticket {
  id: string
  label: string
  shortLabel: string
  outcome: Outcome
}

/** Copy shown on the prize-reveal panel, derived from an Outcome.
 *  `amount` is the single dominant line (e.g. "£100" or, for non-money results,
 *  a headline like "NO INSTANT WIN"). `unit` is the large word beneath a money
 *  value (e.g. "CASH", "SITE CREDIT"). `isMoney` switches the panel from the
 *  giant-currency treatment to the headline treatment. `support2` is an
 *  optional second reassurance line (used by the non-winning result). */
export interface RevealCopy {
  tone: "big" | "cash" | "credit" | "mystery" | "none"
  eyebrow: string
  amount: string
  unit: string
  support: string
  support2?: string
  isMoney: boolean
}

/** Dev-only demo control preset for the outcome selector. */
export type OutcomePreset =
  | "none"
  | "credit5"
  | "cash100"
  | "cash5000"
  | "mystery"
  | "mixed5"

/**
 * The number of purchased tickets. Each ticket is one shot and shows as one
 * numbered football in the tray; a used football leaves the tray after its
 * shot. The signature demo is five tickets, so this stays a small, legible
 * count in the dev controls (1 / 3 / 5).
 */
export type TicketCount = number

/** Dev-only settings. These never affect production code paths. */
export interface DemoSettings {
  preset: OutcomePreset
  ticketCount: TicketCount
  soundOn: boolean
  reducedMotion: boolean
  /** 1 = normal, 2 = 0.5×, 4 = 0.25×. Drives every animation duration. */
  timeScale: TimeScale
  skipIntro: boolean
  /** Force the flight path (win/miss variant) regardless of outcome. */
  shotPath: ShotPath
  /** Static pose preview for asset inspection; "off" = live gameplay. */
  charPreview: CharPreview
  /* ---- guide overlays (all default off; invisible in normal gameplay) ---- */
  showMouthTarget: boolean
  showMouthMask: boolean
  showCharBounds: boolean
  showScoredBounds: boolean
  showPrizeSafe: boolean
  showEndpoint: boolean
  showState: boolean
}

/** Conceptual sound cues. No external audio files are required. */
export type SoundCue =
  | "select"
  | "charge"
  | "launch"
  | "impact"
  | "prize"
  | "nowin"
