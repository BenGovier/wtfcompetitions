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
  | "launched"
  | "impact"
  | "revealing"
  | "revealed"
  | "next_ticket"
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

/** Copy shown on the prize-reveal panel, derived from an Outcome. */
export interface RevealCopy {
  tone: "big" | "cash" | "credit" | "mystery" | "none"
  eyebrow: string
  value: string
  support: string
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
 * The number of purchased tickets = the length of the reveal queue.
 * This is intentionally an open number (1 → hundreds). It is NOT the number of
 * footballs on screen — there are always exactly five reusable footballs.
 */
export type TicketCount = number

/** Dev-only settings. These never affect production code paths. */
export interface DemoSettings {
  preset: OutcomePreset
  ticketCount: TicketCount
  soundOn: boolean
  reducedMotion: boolean
  showMouthTarget: boolean
  showGuides: boolean
  slowMotion: boolean
  skipIntro: boolean
}

/** Conceptual sound cues. No external audio files are required. */
export type SoundCue =
  | "select"
  | "charge"
  | "launch"
  | "impact"
  | "prize"
  | "nowin"
