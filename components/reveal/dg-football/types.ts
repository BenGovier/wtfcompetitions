/**
 * DG'S BIG BALLERS — shared types for the isolated /dgfootballidea prototype.
 *
 * PROTOTYPE ONLY. No Supabase, no checkout, no payments, no award allocation,
 * no API routes. Every value here is mock/presentation data.
 */

/** The single, typed game state. Never model this with loose booleans. */
export type GameState =
  | "intro"
  | "choosing"
  | "selected"
  | "aiming"
  | "launching"
  | "pre_impact"
  | "impact"
  | "suspense"
  | "revealing"
  | "revealed"
  | "transitioning_next"
  | "complete"

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
 *  a headline like "STILL IN THE FINAL DRAW"). `unit` is the large word beneath
 *  a money value (e.g. "CASH", "SITE CREDIT"). `isMoney` switches the panel from
 *  the giant-currency treatment to the headline treatment. */
export interface RevealCopy {
  tone: "big" | "cash" | "credit" | "mystery" | "none"
  eyebrow: string
  amount: string
  unit: string
  support: string
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
  slowMotion: boolean
  skipIntro: boolean
  /* Debug overlays (all default off; invisible in normal gameplay). */
  showMouthTarget: boolean
  showImageBounds: boolean
  showEndpoint: boolean
  showViewportCentre: boolean
  showAnimState: boolean
}

/** Conceptual sound cues. No external audio files are required. */
export type SoundCue =
  | "select"
  | "charge"
  | "launch"
  | "impact"
  | "prize"
  | "nowin"
