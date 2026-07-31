import { describe, it, expect } from 'vitest'
import {
  ACQUIRED_NAME_MAX_LENGTH,
  ACQUIRED_NAME_PATTERN,
  classifyAcquiredCustomerError,
  deriveCustomerName,
  normalizeCustomerName,
  resolveCustomerName,
  validateCustomerName,
} from '@/lib/acquired/customer-name'

/**
 * These tests are the authoritative coverage for the Acquired customer-name
 * fix. The checkout route (app/api/payments/acquired/create-checkout/route.ts)
 * delegates ALL name decisions to these pure functions, so the HTTP behaviour
 * required by the spec is expressed here as:
 *   - resolveCustomerName(...) not ok  => route returns 422 BEFORE calling
 *     Acquired (customer_name_required / customer_name_invalid).
 *   - classifyAcquiredCustomerError(...) === 'name_validation' => route maps a
 *     provider 400 to 422; 'reference_conflict' => unchanged recovery;
 *     'upstream' => unchanged 502.
 */

describe('normalizeCustomerName', () => {
  it('preserves a normal name unchanged', () => {
    const r = normalizeCustomerName('Edward')
    expect(r.value).toBe('Edward')
    expect(r.wasNormalised).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    const r = normalizeCustomerName('  Edward  ')
    expect(r.value).toBe('Edward')
    expect(r.wasNormalised).toBe(true)
  })

  it('collapses repeated internal spaces', () => {
    expect(normalizeCustomerName('Mary   Jane').value).toBe('Mary Jane')
  })

  it('collapses tabs/newlines to a single space', () => {
    expect(normalizeCustomerName('Mary\t\nJane').value).toBe('Mary Jane')
  })

  it('keeps a hyphenated surname', () => {
    const r = normalizeCustomerName('Smith-Jones')
    expect(r.value).toBe('Smith-Jones')
    expect(ACQUIRED_NAME_PATTERN.test(r.value)).toBe(true)
  })

  it('keeps an apostrophe surname', () => {
    const r = normalizeCustomerName("O'Brien")
    expect(r.value).toBe("O'Brien")
    expect(ACQUIRED_NAME_PATTERN.test(r.value)).toBe(true)
  })

  it('folds accented characters to base ASCII (José -> Jose)', () => {
    const r = normalizeCustomerName('José')
    expect(r.value).toBe('Jose')
    expect(r.wasNormalised).toBe(true)
    expect(ACQUIRED_NAME_PATTERN.test(r.value)).toBe(true)
  })

  it('folds precomposed and decomposed accents identically', () => {
    // U+00F1 (ñ) vs n + U+0303 (combining tilde) both fold to "n".
    expect(normalizeCustomerName('Pe\u00f1a').value).toBe('Pena')
    expect(normalizeCustomerName('Pen\u0303a').value).toBe('Pena')
  })

  it('folds smart apostrophes and unicode dashes to ASCII', () => {
    expect(normalizeCustomerName('O\u2019Brien').value).toBe("O'Brien")
    expect(normalizeCustomerName('Smith\u2013Jones').value).toBe('Smith-Jones')
  })

  it('does not throw on non-string input', () => {
    expect(normalizeCustomerName(undefined).value).toBe('')
    expect(normalizeCustomerName(null).value).toBe('')
    expect(normalizeCustomerName(42 as unknown).value).toBe('')
  })
})

describe('validateCustomerName', () => {
  it('accepts a normal first and last name', () => {
    expect(validateCustomerName('Edward', 'first_name')).toMatchObject({ ok: true, value: 'Edward' })
    expect(validateCustomerName('Johnson', 'last_name')).toMatchObject({ ok: true, value: 'Johnson' })
  })

  it('accepts a name after trimming surrounding whitespace', () => {
    expect(validateCustomerName('  Edward ', 'first_name')).toMatchObject({ ok: true, value: 'Edward' })
  })

  it('accepts a name after collapsing repeated internal spaces', () => {
    expect(validateCustomerName('Mary   Jane', 'first_name')).toMatchObject({
      ok: true,
      value: 'Mary Jane',
    })
  })

  it('accepts a hyphenated surname', () => {
    expect(validateCustomerName('Smith-Jones', 'last_name')).toMatchObject({ ok: true })
  })

  it('accepts a surname containing an apostrophe', () => {
    expect(validateCustomerName("O'Brien", 'last_name')).toMatchObject({ ok: true })
  })

  it('accepts accented characters by folding them', () => {
    expect(validateCustomerName('José', 'first_name')).toMatchObject({ ok: true, value: 'Jose' })
  })

  it('accepts a compound surname containing spaces', () => {
    expect(validateCustomerName('van der Berg', 'last_name')).toMatchObject({
      ok: true,
      value: 'van der Berg',
    })
  })

  it('rejects a missing first name as customer_name_required', () => {
    expect(validateCustomerName('', 'first_name')).toMatchObject({
      ok: false,
      error: 'customer_name_required',
      field: 'first_name',
    })
  })

  it('rejects a missing surname as customer_name_required', () => {
    expect(validateCustomerName(undefined, 'last_name')).toMatchObject({
      ok: false,
      error: 'customer_name_required',
      field: 'last_name',
    })
  })

  it('rejects a whitespace-only surname as customer_name_required', () => {
    expect(validateCustomerName('   ', 'last_name')).toMatchObject({
      ok: false,
      error: 'customer_name_required',
    })
  })

  it('rejects names with digits or symbols as customer_name_invalid', () => {
    expect(validateCustomerName('Edward3', 'first_name')).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
    })
    expect(validateCustomerName('a@b', 'last_name')).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
    })
  })

  it('rejects characters that cannot fold to ASCII (e.g. œ, ß)', () => {
    expect(validateCustomerName('œlan', 'first_name')).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
    })
    expect(validateCustomerName('Straße', 'last_name')).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
    })
  })

  it('accepts the provider-confirmed maximum length (50)', () => {
    const fifty = 'a'.repeat(ACQUIRED_NAME_MAX_LENGTH)
    expect(fifty.length).toBe(50)
    expect(validateCustomerName(fifty, 'last_name')).toMatchObject({ ok: true })
  })

  it('rejects a name longer than the provider maximum (51)', () => {
    const fiftyOne = 'a'.repeat(ACQUIRED_NAME_MAX_LENGTH + 1)
    expect(validateCustomerName(fiftyOne, 'last_name')).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
    })
  })
})

describe('deriveCustomerName', () => {
  it('gives stored metadata precedence over full-name sources', () => {
    expect(
      deriveCustomerName({
        metaFirstName: 'Edward',
        metaLastName: 'Johnson',
        realName: 'Someone Else',
        metaDisplayName: 'Nickname',
      }),
    ).toEqual({ firstName: 'Edward', lastName: 'Johnson' })
  })

  it('falls back to real_name when metadata is missing (full-name fallback)', () => {
    expect(deriveCustomerName({ realName: 'Edward Johnson' })).toEqual({
      firstName: 'Edward',
      lastName: 'Johnson',
    })
  })

  it('prefers real_name over display_name', () => {
    expect(
      deriveCustomerName({ realName: 'Edward Johnson', metaDisplayName: 'Nick Name' }),
    ).toEqual({ firstName: 'Edward', lastName: 'Johnson' })
  })

  it('uses display_name when real_name is absent', () => {
    expect(deriveCustomerName({ metaDisplayName: 'Edward Johnson' })).toEqual({
      firstName: 'Edward',
      lastName: 'Johnson',
    })
  })

  it('treats a multi-word surname as everything after the first token', () => {
    expect(deriveCustomerName({ realName: 'Edward van der Berg' })).toEqual({
      firstName: 'Edward',
      lastName: 'van der Berg',
    })
  })

  it('only fills the missing part from the full-name source', () => {
    expect(
      deriveCustomerName({ metaFirstName: 'Eddie', realName: 'Edward Johnson' }),
    ).toEqual({ firstName: 'Eddie', lastName: 'Johnson' })
  })

  it('leaves the surname empty for a single-word name', () => {
    expect(deriveCustomerName({ realName: 'Cher' })).toEqual({ firstName: 'Cher', lastName: '' })
  })
})

describe('resolveCustomerName', () => {
  it('resolves and normalises a full valid name', () => {
    expect(resolveCustomerName({ metaFirstName: '  José ', metaLastName: 'Peña' })).toEqual({
      ok: true,
      firstName: 'Jose',
      lastName: 'Pena',
      wasNormalised: true,
    })
  })

  it('returns customer_name_required for a single-word name (missing surname)', () => {
    expect(resolveCustomerName({ realName: 'Cher' })).toMatchObject({
      ok: false,
      error: 'customer_name_required',
      field: 'last_name',
    })
  })

  it('returns customer_name_required when the first name is missing', () => {
    expect(resolveCustomerName({ metaLastName: 'Johnson' })).toMatchObject({
      ok: false,
      error: 'customer_name_required',
      field: 'first_name',
    })
  })

  it('returns customer_name_invalid for a bad surname and reports its length', () => {
    const r = resolveCustomerName({ metaFirstName: 'Edward', metaLastName: 'Johnson99' })
    expect(r).toMatchObject({
      ok: false,
      error: 'customer_name_invalid',
      field: 'last_name',
    })
    if (!r.ok) expect(r.nameLength).toBe('Johnson99'.length)
  })

  it('checks the first name before the last name', () => {
    // both invalid -> first_name reported first
    expect(resolveCustomerName({ metaFirstName: 'Bad1', metaLastName: 'Bad2' })).toMatchObject({
      field: 'first_name',
    })
  })
})

describe('classifyAcquiredCustomerError', () => {
  it('maps a 400 naming last_name to name_validation/last_name', () => {
    const body = { invalid_parameters: [{ parameter: 'last_name', reason: 'invalid' }] }
    expect(classifyAcquiredCustomerError(400, body)).toEqual({
      kind: 'name_validation',
      field: 'last_name',
    })
  })

  it('maps a 400 naming first_name to name_validation/first_name', () => {
    const body = { invalid_parameters: [{ parameter: 'first_name' }] }
    expect(classifyAcquiredCustomerError(400, body)).toEqual({
      kind: 'name_validation',
      field: 'first_name',
    })
  })

  it('detects the field from free-text bodies as a fallback', () => {
    expect(classifyAcquiredCustomerError(400, { message: 'last_name validation failed' })).toEqual({
      kind: 'name_validation',
      field: 'last_name',
    })
  })

  it('maps a 409 reference conflict to reference_conflict (recovery unchanged)', () => {
    const body = { invalid_parameters: [{ parameter: 'reference' }] }
    expect(classifyAcquiredCustomerError(409, body)).toEqual({ kind: 'reference_conflict' })
  })

  it('treats a 400 with no name/field info as upstream (stays 502)', () => {
    expect(classifyAcquiredCustomerError(400, { message: 'bad request' })).toEqual({
      kind: 'upstream',
    })
  })

  it('treats 5xx / auth / empty bodies as upstream (stays 502)', () => {
    expect(classifyAcquiredCustomerError(500, null)).toEqual({ kind: 'upstream' })
    expect(classifyAcquiredCustomerError(401, {})).toEqual({ kind: 'upstream' })
    expect(classifyAcquiredCustomerError(503, 'gateway error')).toEqual({ kind: 'upstream' })
  })

  it('does not misclassify a 409 that names first_name as a name error', () => {
    // Only 400 is a deterministic name-validation status; a 409 is a conflict.
    const body = { invalid_parameters: [{ parameter: 'first_name' }] }
    expect(classifyAcquiredCustomerError(409, body)).toEqual({ kind: 'upstream' })
  })
})
