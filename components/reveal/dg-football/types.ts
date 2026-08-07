/**
 * DG'S BIG BALLERS — shared types for the isolated /dgfootballidea prototype.
 *
 * PROTOTYPE ONLY. No Supabase, no checkout, no payments, no award allocation,
 * no API routes. Every value here is mock/presentation data.
 *
 * NEW MECHANIC (tap-a-ball → auto shot → into one of five mystery holes):
 *   The customer performs ONE interaction — TAP A BALL. The selected football
 *   automatically launches on a curved path into a five-hole target board and
 *   visibly enters ONE hole. That hole reveals the PREDETERMINED result.
 *   No flicking / swiping / dragging / aiming / hole selection.
 */

/**
 * The single, typed game state. Never model this with loose booleans.
 *
 *   intro → choosing → selected → launching → approaching_hole → entering_hole
 *     WIN:  → win_impact → win_celebration → revealing → revealed
 *     MISS: → nonwin_reaction → revealing → revealed
 *   revealed → transitioning_next → (choosing | complete)
 */
export type GameState =
  | "intro"
  | "choosing"
  | "selected"
  | "launching"
  | "approaching_hole"
  | "entering_hole"
  | "win_impact"
  | "nonwin_reaction"
  | "win_celebration"
  | "revealing"
  | "revealed"
  | "transitioning_next"
  | "complete"

/** Which supplied photo DG is showing. Derived from GameState — never ad-hoc.
 *  dg-neutral: everything except a winning celebration.
 *  dg-scored:  winning celebration + behind the winning prize panel only. */
export type CharacterPose = "neutral" | "scored"

/** The five target-board holes. These are HOLE identifiers, not ticket numbers. */
export type HoleId = 1 | 2 | 3 | 4 | 5

/** Dev destination override. `auto` uses the ticket's predetermined hole. */
export type DestinationOverride = "auto" | HoleId

/** Dev timing multiplier: 1 = normal, 2 = 0.5×, 4 = 0.25×. */
export type Speed = 1 | 2 | 4

/** Dev static character preview (inspect a single asset), or "off" for live. */
export type CharPreview = "off" | "neutral" | "scored"

/** Imperative dev replay commands fired from the controls. */
export type ReplayKind = "launch" | "hole_entry" | "win" | "nonwin"

/** The kind of instant-win outcome for a single ticket. */
export type OutcomeKind = "none" | "credit" | "cash" | "mystery"

/** A single deterministic mock outcome. `amountPence` is only meaningful for
 *  cash / credit outcomes. Never exposed to the UI before ball entry. */
export interface Outcome {
  kind: OutcomeKind
  /** Whole-pound value in pence for cash/credit, else 0. */
  amountPence: number
}

/**
 * A mock ticket = one shot. Each ticket has a PREDETERMINED outcome AND the
 * board hole the ball visually enters. The cosmetic football the customer taps
 * NEVER changes either of these.
 */
export interface Ticket {
  id: string
  label: string
  shortLabel: string
  outcome: Outcome
  destinationHole: HoleId
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
  | "sequence"
  | "none"
  | "credit5"
  | "cash100"
  | "cash5000"

/**
 * The number of purchased tickets. Each ticket is one shot. The cosmetic tray
 * always shows five footballs regardless of this count. Dev options: 1/3/5/10.
 */
export type TicketCount = number

/** Dev-only settings. These never affect production code paths. */
export interface DemoSettings {
  preset: OutcomePreset
  ticketCount: TicketCount
  soundOn: boolean
  reducedMotion: boolean
  /** 1 = normal, 2 = 0.5×, 4 = 0.25×. Drives every animation duration. */
  speed: Speed
  skipIntro: boolean
  /** Force the destination hole regardless of the ticket. `auto` = predetermined. */
  destination: DestinationOverride
  /** Static pose preview for asset inspection; "off" = live gameplay. */
  charPreview: CharPreview
  /* ---- guide overlays (all default off; invisible in normal gameplay) ---- */
  showHoleBounds: boolean
  showHoleCentres: boolean
  showBallOrigin: boolean
  showControlPoints: boolean
  showEndpoint: boolean
  showBoardBounds: boolean
  showState: boolean
}

/** Conceptual sound cues. No external audio files are required. */
export type SoundCue =
  | "select"
  | "launch"
  | "whoosh"
  | "drop"
  | "impact"
  | "prize"
  | "credit"
  | "nowin"
