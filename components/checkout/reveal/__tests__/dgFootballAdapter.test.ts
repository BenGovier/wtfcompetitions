import { describe, expect, it } from 'vitest'
import {
  awardToRevealPlan,
  classifyPrize,
  ticketRangeText,
  type DgFootballAward,
  type DgFootballPrize,
} from '../dgFootballAdapter'
import { summarisePlan } from '@/components/reveal/dg-football/config'

// The adapter is the ONLY bridge from the already-decided AwardPayload to the
// DG Football presentation model. These tests pin the safety contract:
//   * prizes[] is the source of truth (award count == prizes.length, no cap)
//   * qty (not the 5 balls / 5 holes) drives the ticket count
//   * cash / credit / manual classification never fabricates a value
//   * the itemised summary always reconciles to prizes.length

const cash = (value: string, title = 'Cash Prize'): DgFootballPrize => ({
  title,
  value_text: value,
})
const credit = (value: string): DgFootballPrize => ({ title: 'Site Credit', value_text: value })
const manual = (title: string, image?: string): DgFootballPrize => ({
  title,
  value_text: null,
  image_url: image ?? null,
})

function baseAward(overrides: Partial<DgFootballAward>): DgFootballAward {
  return {
    qty: 1,
    won: true,
    prize: null,
    prizes: [],
    ticket_start: null,
    ticket_end: null,
    ...overrides,
  }
}

describe('classifyPrize — presentation category (never fabricates value)', () => {
  it('classifies explicit £ money as cash in pence', () => {
    expect(classifyPrize(cash('£100'))).toMatchObject({ kind: 'cash', amountPence: 10000 })
    expect(classifyPrize(cash('£5,000'))).toMatchObject({ kind: 'cash', amountPence: 500000 })
    expect(classifyPrize(cash('£12.50'))).toMatchObject({ kind: 'cash', amountPence: 1250 })
  })

  it('classifies "credit" keyword with a value as site credit', () => {
    expect(classifyPrize(credit('£10 Site Credit'))).toMatchObject({ kind: 'credit', amountPence: 1000 })
  })

  it('treats a physical prize as manual with NO money value', () => {
    const out = classifyPrize(manual('PlayStation 5', 'https://cdn/ps5.png'))
    expect(out.kind).toBe('manual')
    expect(out.amountPence).toBe(0)
    expect(out.title).toBe('PlayStation 5')
    expect(out.imageUrl).toBe('https://cdn/ps5.png')
  })

  it('does NOT misread a titled physical prize as a tiny cash win', () => {
    // "PlayStation 5" contains a 5 but no "£", so it must NOT become £5 cash.
    const out = classifyPrize(manual('PlayStation 5'))
    expect(out.kind).toBe('manual')
    expect(out.amountPence).toBe(0)
  })

  it('treats "credit" with no parseable amount as a manual/named award', () => {
    expect(classifyPrize({ title: 'Store Credit Voucher', value_text: 'credit' }).kind).toBe('manual')
  })
})

describe('awardToRevealPlan — prizes[] is the source of truth', () => {
  it('animates EXACTLY prizes.length awards with no cap (7 wins)', () => {
    const prizes = [
      cash('£100'),
      cash('£250'),
      cash('£5,000'),
      cash('£50'),
      cash('£25'),
      credit('£10 credit'),
      credit('£5 credit'),
    ]
    const plan = awardToRevealPlan(baseAward({ qty: 125, prizes }))
    expect(plan.awards).toHaveLength(7)
    expect(plan.ticketCount).toBe(125)
  })

  it('never lets two consecutive awards share a hole', () => {
    const prizes = Array.from({ length: 7 }, () => cash('£25'))
    const plan = awardToRevealPlan(baseAward({ qty: 7, prizes }))
    for (let i = 1; i < plan.awards.length; i++) {
      expect(plan.awards[i].destinationHole).not.toBe(plan.awards[i - 1].destinationHole)
    }
  })

  it('derives ticketCount from qty, NOT from the number of prizes or holes', () => {
    const plan = awardToRevealPlan(baseAward({ qty: 40, prizes: [cash('£100'), cash('£50')] }))
    expect(plan.ticketCount).toBe(40)
    expect(plan.awards).toHaveLength(2)
  })

  it('produces a zero-win plan when there are no prizes', () => {
    const plan = awardToRevealPlan(baseAward({ qty: 10, won: false, prize: null, prizes: [] }))
    expect(plan.awards).toHaveLength(0)
    expect(plan.ticketCount).toBe(10)
  })

  it('falls back to the singular legacy prize when prizes[] is absent', () => {
    const plan = awardToRevealPlan(baseAward({ qty: 3, prize: cash('£100'), prizes: undefined }))
    expect(plan.awards).toHaveLength(1)
    expect(plan.awards[0].outcome).toMatchObject({ kind: 'cash', amountPence: 10000 })
  })

  it('drops malformed prizes with no usable title (never renders blank)', () => {
    const prizes = [cash('£100'), { title: '   ', value_text: '£5' } as DgFootballPrize]
    const plan = awardToRevealPlan(baseAward({ qty: 2, prizes }))
    expect(plan.awards).toHaveLength(1)
  })

  it('coerces a non-positive / non-finite qty to a safe 1', () => {
    expect(awardToRevealPlan(baseAward({ qty: 0, prizes: [cash('£100')] })).ticketCount).toBe(1)
    expect(awardToRevealPlan(baseAward({ qty: Number.NaN, prizes: [cash('£100')] })).ticketCount).toBe(1)
  })
})

describe('summary reconciliation — itemised totals always equal prizes.length', () => {
  it('reconciles a mixed 7-win purchase exactly', () => {
    const prizes = [
      cash('£100'),
      cash('£250'),
      cash('£5,000'),
      cash('£50'),
      cash('£25'),
      credit('£10 credit'),
      credit('£5 credit'),
    ]
    const plan = awardToRevealPlan(baseAward({ qty: 125, prizes }))
    const summary = summarisePlan(plan)

    // Every award is represented; item counts sum to prizes.length.
    const counted = summary.items.reduce((n, it) => n + it.count, 0)
    expect(counted).toBe(prizes.length)
    expect(summary.instantWins).toBe(7)

    // Totals: cash 100+250+5000+50+25 = 5425; credit 10+5 = 15.
    expect(summary.cashPence).toBe(542500)
    expect(summary.creditPence).toBe(1500)
  })

  it('collapses identical awards into an N× line while preserving the count', () => {
    const prizes = [cash('£25'), cash('£25'), cash('£25')]
    const summary = summarisePlan(awardToRevealPlan(baseAward({ qty: 3, prizes })))
    const cashLine = summary.items.find((i) => i.kind === 'cash')
    expect(cashLine?.count).toBe(3)
    expect(summary.cashPence).toBe(7500)
  })

  it('keeps distinct physical prizes as separate lines with no money total', () => {
    const prizes = [manual('PlayStation 5'), manual('Xbox Series X'), manual('PlayStation 5')]
    const summary = summarisePlan(awardToRevealPlan(baseAward({ qty: 3, prizes })))
    const manualItems = summary.items.filter((i) => i.kind === 'manual')
    // PS5 (×2) collapses, Xbox stays separate → 2 lines, 3 awards total.
    expect(manualItems).toHaveLength(2)
    expect(manualItems.reduce((n, i) => n + i.count, 0)).toBe(3)
    expect(summary.cashPence).toBe(0)
    expect(summary.creditPence).toBe(0)
  })
})

describe('ticketRangeText — header parity label', () => {
  it('formats a multi-ticket range with an en-dash and thousands separators', () => {
    expect(ticketRangeText(1201, 1325)).toBe('TICKETS #1,201\u2013#1,325')
  })
  it('formats a single ticket', () => {
    expect(ticketRangeText(42, 42)).toBe('TICKET #42')
  })
  it('returns undefined for missing or nonsensical ranges', () => {
    expect(ticketRangeText(null, null)).toBeUndefined()
    expect(ticketRangeText(10, 5)).toBeUndefined()
    expect(ticketRangeText(undefined, 5)).toBeUndefined()
  })
})
