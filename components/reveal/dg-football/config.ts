/**
 * DG'S BIG BALLERS — configuration, palette, timings, mock data and copy.
 * PROTOTYPE ONLY. Deterministic. No randomisation, no backend.
 */

import type {
  CharPreview,
  DemoSettings,
  DestinationOverride,
  HoleId,
  Outcome,
  OutcomeKind,
  OutcomePreset,
  RevealCopy,
  Speed,
  Ticket,
  TicketCount,
} from "./types"

/* -------------------------------------------------------------------------- */
/*  Palette                                                                   */
/* -------------------------------------------------------------------------- */
export const COLORS = {
  black: "#050705",
  charcoalDeep: "#0C100D",
  charcoalPanel: "#111712",
  neon: "#A8FF19",
  neon2: "#5DFF00",
  glow: "rgba(168, 255, 25, 0.35)",
  white: "#F7F7F2",
  muted: "#A7B0A4",
  gold: "#FFD84A",
  cash: "#7CFF67",
} as const

/* -------------------------------------------------------------------------- */
/*  Assets                                                                    */
/*  dg-board-reference.png is VISUAL REFERENCE ONLY — never rendered as the    */
/*  game. The board, holes, DG and effects are all independent DOM/CSS/SVG.    */
/* -------------------------------------------------------------------------- */
export const ASSETS = {
  /** Initial / choosing / shot-in-progress / non-win / between / summary. */
  dgNeutral: "/reveal/dg-football/dg-neutral.png",
  /** Winning celebration + behind the winning prize panel ONLY. */
  dgScored: "/reveal/dg-football/dg-scored.png",
} as const

/* -------------------------------------------------------------------------- */
/*  Timings (ms, at speed = 1). Multiply by the speed factor at runtime.      */
/* -------------------------------------------------------------------------- */
export const TIMING = {
  introMs: 900,
  /** Ball lift on tap before it is locked in. */
  ballLiftMs: 200,
  /** Selection is held (spec: 220–300ms) before the shot auto-begins. */
  selectHoldMs: 260,
  /** Auto-shot flight (spec: 850–1050ms) — slower so the landing is enjoyable. */
  flightMs: 950,
  /** Reduced-motion straight-line flight. */
  reducedFlightMs: 440,
  /** Lead before entry when the destination hole is revealed (spec: ~220ms). */
  anticipationLeadMs: 220,
  /** Ball-into-hole entry sequence (spec: 180–240ms). */
  holeEntryMs: 210,
  /** Win impact hold at the hole before DG celebrates (spec: ~350ms). */
  winImpactMs: 350,
  /** dg-scored punch-in takeover (spec: 300–380ms). */
  scoredTakeoverMs: 340,
  /** Top-prize (£5,000) extends the celebration takeover. */
  topPrizeExtraMs: 140,
  /** Non-win reaction hold before the panel (spec: 350–450ms). */
  nonwinHoldMs: 400,
  /** Pause after the win celebration settles, before the prize panel rises. */
  pauseBeforePanelMs: 240,
  /** Prize-panel entrance (spec: 700–900ms). */
  panelRiseMs: 820,
  /** Return-to-choosing reflow after a shot. */
  reflowMs: 600,
  /** Camera punch-in total. */
  cameraPunchMs: 300,
  /** Screen-shake duration. */
  shakeMs: 200,
} as const

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */
/** Tray football diameter (px) at a 390px stage (spec: 58–68px). */
export const BALL_SIZE = 62

/** In-flight ball diameter (px). Stays large enough to follow (spec: 44–54px
 *  near the hole) — we launch a touch bigger and keep it readable. */
export const FLIGHT_BALL_SIZE = 54

/** Number of cosmetic footballs in the tray each shot (always five). */
export const TRAY_BALL_COUNT = 5

/**
 * Target board rectangle as fractions of the stage. DG stands to the LEFT and
 * partially overlaps the board's left edge, so the board is nudged right.
 */
export const BOARD_RECT = {
  leftPct: 0.15,
  topPct: 0.2,
  widthPct: 0.78,
  heightPct: 0.5,
} as const

/**
 * The five holes as fractions of the board's INNER face, in the quincunx:
 *     1     2
 *        3
 *     4     5
 * Measured in the DOM at runtime; these drive the CSS placement.
 */
export const HOLES: Record<HoleId, { xPct: number; yPct: number }> = {
  1: { xPct: 0.29, yPct: 0.24 },
  2: { xPct: 0.71, yPct: 0.24 },
  3: { xPct: 0.5, yPct: 0.5 },
  4: { xPct: 0.29, yPct: 0.76 },
  5: { xPct: 0.71, yPct: 0.76 },
} as const

export const HOLE_IDS: HoleId[] = [1, 2, 3, 4, 5]

/** Hole diameter (px) at a 390px stage (spec: 86–104px). Scales with board. */
export const HOLE_SIZE = 94

/* -------------------------------------------------------------------------- */
/*  Outcome helpers                                                           */
/* -------------------------------------------------------------------------- */
const pounds = (p: number) => p / 100

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds(pence))
}

const OUTCOME_NONE: Outcome = { kind: "none", amountPence: 0 }
const OUTCOME_CREDIT5: Outcome = { kind: "credit", amountPence: 500 }
const OUTCOME_CASH100: Outcome = { kind: "cash", amountPence: 10000 }
const OUTCOME_CASH5000: Outcome = { kind: "cash", amountPence: 500000 }

/** Big-win threshold — drives the gold, light-ray, confetti treatment. */
export const BIG_WIN_PENCE = 100000

export function isBigWin(o: Outcome): boolean {
  return o.kind === "cash" && o.amountPence >= BIG_WIN_PENCE
}

export function isWinOutcome(o: Outcome): boolean {
  return o.kind !== "none"
}

/**
 * Derive the reveal-panel copy from an outcome. Kept deterministic and free of
 * any negative / "you lose" framing for the non-winning case.
 */
export function revealCopyFor(o: Outcome): RevealCopy {
  switch (o.kind) {
    case "cash":
      if (isBigWin(o)) {
        return {
          tone: "big",
          eyebrow: "INSTANT WIN!",
          amount: formatGBP(o.amountPence),
          unit: "CASH",
          support: "WHAT A STRIKE!",
          isMoney: true,
        }
      }
      return {
        tone: "cash",
        eyebrow: "INSTANT WIN!",
        amount: formatGBP(o.amountPence),
        unit: "CASH",
        support: "WHAT A STRIKE!",
        isMoney: true,
      }
    case "credit":
      return {
        tone: "credit",
        eyebrow: "BONUS WIN!",
        amount: formatGBP(o.amountPence),
        unit: "SITE CREDIT",
        support: "NICE ONE!",
        isMoney: true,
      }
    case "mystery":
      return {
        tone: "mystery",
        eyebrow: "YOU'VE WON!",
        amount: "MYSTERY PRIZE",
        unit: "",
        support: "OUR TEAM WILL CONTACT YOU",
        isMoney: false,
      }
    case "none":
    default:
      // Non-winning: never a loss. Positive, forward-looking framing only.
      return {
        tone: "none",
        eyebrow: "NO INSTANT WIN",
        amount: "YOU'RE STILL IN",
        unit: "",
        support: "THE FINAL DRAW",
        support2: "YOUR NEXT SHOT IS READY",
        isMoney: false,
      }
  }
}

/* -------------------------------------------------------------------------- */
/*  Instruction copy per state                                                */
/* -------------------------------------------------------------------------- */
export const INSTRUCTIONS: Record<string, { text: string; key?: string; sub?: string } | null> = {
  intro: null,
  // The hero instruction lives in the brand header; the tray shows "TAP A BALL".
  choosing: { text: "CHOOSE A", key: "BALL", sub: "WATCH WHERE IT LANDS..." },
  selected: { text: "HERE WE", key: "GO!" },
  launching: { text: "HERE WE", key: "GO!" },
  approaching_hole: null,
  entering_hole: null,
  win_impact: null,
  nonwin_reaction: null,
  win_celebration: null,
  revealing: null,
  revealed: null,
  transitioning_next: null,
  complete: null,
}

/** The primary call-to-action shown directly above the tray. */
export const TAP_A_BALL = "TAP A BALL"

/* -------------------------------------------------------------------------- */
/*  Deterministic mock ticket sequence                                        */
/*  DEFAULT (per spec):                                                        */
/*    1: no win        → hole 4                                                */
/*    2: £5 credit     → hole 2                                                */
/*    3: no win        → hole 1                                                */
/*    4: £100 cash     → hole 5                                                */
/*    5: £5,000 cash   → hole 3                                                */
/* -------------------------------------------------------------------------- */
interface Seed {
  outcome: Outcome
  hole: HoleId
}

const SEQUENCE: Seed[] = [
  { outcome: OUTCOME_NONE, hole: 4 },
  { outcome: OUTCOME_CREDIT5, hole: 2 },
  { outcome: OUTCOME_NONE, hole: 1 },
  { outcome: OUTCOME_CASH100, hole: 5 },
  { outcome: OUTCOME_CASH5000, hole: 3 },
]

const outcomeForPreset: Record<Exclude<OutcomePreset, "sequence">, Outcome> = {
  none: OUTCOME_NONE,
  credit5: OUTCOME_CREDIT5,
  cash100: OUTCOME_CASH100,
  cash5000: OUTCOME_CASH5000,
}

/** Rotate holes for single-outcome presets so repeats still feel varied. */
const HOLE_ROTATION: HoleId[] = [4, 2, 1, 5, 3]

function makeTicket(index: number, seed: Seed): Ticket {
  const n = index + 1
  return {
    id: `mock-ticket-${n}`,
    label: `TICKET ${n}`,
    shortLabel: `#${n}`,
    outcome: seed.outcome,
    destinationHole: seed.hole,
  }
}

/**
 * Build a deterministic ticket list for the given preset + count.
 * - "sequence" cycles the signature five-shot arc to fill the requested count.
 * - Any single-outcome preset repeats that outcome, rotating holes.
 */
export function buildTickets(preset: OutcomePreset, count: TicketCount): Ticket[] {
  const seeds: Seed[] =
    preset === "sequence"
      ? Array.from({ length: count }, (_, i) => SEQUENCE[i % SEQUENCE.length])
      : Array.from({ length: count }, (_, i) => ({
          outcome: outcomeForPreset[preset],
          hole: HOLE_ROTATION[i % HOLE_ROTATION.length],
        }))
  return seeds.map((s, i) => makeTicket(i, s))
}

/* -------------------------------------------------------------------------- */
/*  Dev option lists                                                          */
/* -------------------------------------------------------------------------- */
export const OUTCOME_PRESET_OPTIONS: { value: OutcomePreset; label: string }[] = [
  { value: "sequence", label: "Default sequence" },
  { value: "none", label: "No instant win" },
  { value: "credit5", label: "£5 site credit" },
  { value: "cash100", label: "£100 cash" },
  { value: "cash5000", label: "£5,000 cash" },
]

export const DESTINATION_OPTIONS: { value: DestinationOverride; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
]

export const TICKET_COUNT_OPTIONS: TicketCount[] = [1, 3, 5, 10]

export const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 1, label: "Normal" },
  { value: 2, label: "0.5×" },
  { value: 4, label: "0.25×" },
]

export const CHAR_PREVIEW_OPTIONS: { value: CharPreview; label: string }[] = [
  { value: "off", label: "Live game" },
  { value: "neutral", label: "Neutral" },
  { value: "scored", label: "Scored" },
]

export const DEFAULT_SETTINGS: DemoSettings = {
  preset: "sequence",
  ticketCount: 5,
  soundOn: false,
  reducedMotion: false,
  speed: 1,
  skipIntro: false,
  destination: "auto",
  charPreview: "off",
  showHoleBounds: false,
  showHoleCentres: false,
  showBallOrigin: false,
  showControlPoints: false,
  showEndpoint: false,
  showBoardBounds: false,
  showState: false,
}

/** Human labels for outcome kinds (dev summary use). */
export const KIND_LABEL: Record<OutcomeKind, string> = {
  none: "No win",
  credit: "Site credit",
  cash: "Cash",
  mystery: "Mystery",
}
