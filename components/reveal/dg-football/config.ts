/**
 * DG'S BIG BALLERS — configuration, palette, timings, mock data and copy.
 * PROTOTYPE ONLY. Deterministic. No randomisation, no backend.
 */

import type {
  DemoSettings,
  Outcome,
  OutcomeKind,
  OutcomePreset,
  RevealCopy,
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
/*  Asset paths (real character photos — supplied separately)                 */
/* -------------------------------------------------------------------------- */
export const ASSETS = {
  dgNeutral: "/reveal/dg-football/dg-neutral.png",
  dgMouthOpen: "/reveal/dg-football/dg-mouth-open.png",
} as const

/* -------------------------------------------------------------------------- */
/*  Timings (ms, at speed = 1). Multiply by the speed factor at runtime.      */
/* -------------------------------------------------------------------------- */
export const TIMING = {
  introMs: 900,
  ballLiftMs: 250,
  /** Ball moves to the central launch point ~250ms after selection. */
  ballToLaunchMs: 250,
  tapHintDelayMs: 1400,
  /** Launch flight window (spec: 680–760ms). We use the midpoint. */
  launchMinMs: 680,
  launchMaxMs: 760,
  /** Tension-release pause after a valid flick, before flight begins. */
  tensionReleaseMs: 100,
  /** Green head-glow ramp starts ~220ms before impact. */
  preImpactGlowLeadMs: 220,
  /** Short light sweep across the face ~170ms before impact. */
  preImpactSweepLeadMs: 170,
  /** Expression cross-fade duration (spec: 100–130ms). */
  crossfadeMs: 120,
  /** Impact micro-sequence total. */
  impactMs: 420,
  /** Screen-shake duration (spec: 180–220ms). */
  shakeMs: 200,
  /** Camera punch-in total (spec: ~320ms). */
  cameraPunchMs: 320,
  /** Suspense hold before the prize panel rises (spec: 500–650ms). */
  suspenseMs: 560,
  /** Prize-panel entrance (spec: 700–900ms). */
  panelRiseMs: 820,
  /** Reduced-motion straight-line launch. */
  reducedLaunchMs: 300,
  /** Return-to-choosing reflow after a shot (spec: 500–700ms). */
  reflowMs: 600,
} as const

export const SLOW_FACTOR = 3

/** Minimum upward drag (px) required to trigger a launch on release. */
export const LAUNCH_DRAG_THRESHOLD = 70

/** Tray football diameter (px) at a 390px stage — unselected balls. */
export const BALL_SIZE = 60

/** The selected launch football is dramatically larger and dominant
 *  (spec: 96–112px). It sits alone in the central launch lane. */
export const BALL_SIZE_SELECTED = 104

/** Mouth target position as a fraction of the stage. DG's mouth sits ~43–47%
 *  down the viewport; we centre on 45%. */
export const MOUTH_TARGET = { xPct: 0.5, yPct: 0.45 } as const

/** Home (launch) position of the active football as a fraction of the stage
 *  (spec: 68–74% down before drag). */
export const LAUNCH_HOME = { xPct: 0.5, yPct: 0.71 } as const

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
const OUTCOME_MYSTERY: Outcome = { kind: "mystery", amountPence: 0 }

/** Big-win threshold — drives the gold, light-ray, confetti treatment. */
export const BIG_WIN_PENCE = 100000

export function isBigWin(o: Outcome): boolean {
  return o.kind === "cash" && o.amountPence >= BIG_WIN_PENCE
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
          support: "YOU'VE HIT THE BIG ONE!",
          isMoney: true,
        }
      }
      return {
        tone: "cash",
        eyebrow: "INSTANT WIN!",
        amount: formatGBP(o.amountPence),
        unit: "CASH",
        support: "WHAT A SHOT!",
        isMoney: true,
      }
    case "credit":
      return {
        tone: "credit",
        eyebrow: "BONUS WIN!",
        amount: formatGBP(o.amountPence),
        unit: "SITE CREDIT",
        support: "ADDED TO YOUR WALLET",
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
      return {
        tone: "none",
        eyebrow: "NO INSTANT WIN",
        amount: "YOU'RE STILL IN THE FINAL DRAW",
        unit: "",
        support: "KEEP GOING — YOUR NEXT SHOT IS READY",
        isMoney: false,
      }
  }
}

/* -------------------------------------------------------------------------- */
/*  Instruction copy per state                                                */
/* -------------------------------------------------------------------------- */
export const INSTRUCTIONS: Record<string, { text: string; key?: string } | null> = {
  intro: null,
  choosing: { text: "CHOOSE YOUR", key: "BALL" },
  selected: { text: "FLICK IT TO", key: "DG" },
  aiming: { text: "RELEASE TO", key: "SHOOT" },
  launching: { text: "HERE WE", key: "GO!" },
  pre_impact: { text: "HERE WE", key: "GO!" },
  impact: null,
  suspense: null,
  revealing: null,
  revealed: null,
  transitioning_next: null,
  complete: null,
}

/** Secondary line shown under the selected football before a flick. */
export const SELECTED_SUBHINT = "SWIPE UP TO SHOOT"

/* -------------------------------------------------------------------------- */
/*  Deterministic mock ticket sequences                                       */
/* -------------------------------------------------------------------------- */
const outcomeForPreset: Record<Exclude<OutcomePreset, "mixed5">, Outcome> = {
  none: OUTCOME_NONE,
  credit5: OUTCOME_CREDIT5,
  cash100: OUTCOME_CASH100,
  cash5000: OUTCOME_CASH5000,
  mystery: OUTCOME_MYSTERY,
}

/** The signature default demo sequence (exactly as specified). */
const MIXED5: Outcome[] = [
  OUTCOME_NONE,
  OUTCOME_CREDIT5,
  OUTCOME_CASH100,
  OUTCOME_NONE,
  OUTCOME_CASH5000,
]

function makeTicket(index: number, outcome: Outcome): Ticket {
  const n = index + 1
  return {
    id: `mock-ticket-${n}`,
    label: `TICKET ${n}`,
    shortLabel: `#${n}`,
    outcome,
  }
}

/**
 * Build a deterministic ticket list for the given preset + count.
 * - "mixed5" cycles the signature sequence to fill the requested count.
 * - Any single-outcome preset repeats that outcome across all tickets.
 */
export function buildTickets(preset: OutcomePreset, count: TicketCount): Ticket[] {
  const outcomes: Outcome[] =
    preset === "mixed5"
      ? Array.from({ length: count }, (_, i) => MIXED5[i % MIXED5.length])
      : Array.from({ length: count }, () => outcomeForPreset[preset])
  return outcomes.map((o, i) => makeTicket(i, o))
}

export const OUTCOME_PRESET_OPTIONS: { value: OutcomePreset; label: string }[] = [
  { value: "none", label: "No instant win" },
  { value: "credit5", label: "£5 site credit" },
  { value: "cash100", label: "£100 cash" },
  { value: "cash5000", label: "£5,000 cash" },
  { value: "mystery", label: "Mystery prize" },
  { value: "mixed5", label: "Mixed five-ticket sequence" },
]

/**
 * Demo ticket counts. Each ticket is one shot and one numbered football in the
 * tray; a used football leaves the tray after its shot. The signature demo is
 * the five-ticket mixed sequence, so counts stay small and legible as an arc.
 */
export const TICKET_COUNT_OPTIONS: TicketCount[] = [1, 3, 5]

export const DEFAULT_SETTINGS: DemoSettings = {
  preset: "mixed5",
  ticketCount: 5,
  soundOn: false,
  reducedMotion: false,
  slowMotion: false,
  skipIntro: false,
  showMouthTarget: false,
  showImageBounds: false,
  showEndpoint: false,
  showViewportCentre: false,
  showAnimState: false,
}

/** Human labels for outcome kinds (dev summary use). */
export const KIND_LABEL: Record<OutcomeKind, string> = {
  none: "No win",
  credit: "Site credit",
  cash: "Cash",
  mystery: "Mystery",
}
