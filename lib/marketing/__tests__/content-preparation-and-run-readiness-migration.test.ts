import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// -----------------------------------------------------------------------------
// Stage 037 — Static guards over the content-preparation + run-readiness
// migration (scripts/marketing/023-...). These assert the migration text upholds
// every safety invariant WITHOUT touching a live database, matching the style of
// the Stage 022 boundary-foundation migration test.
// -----------------------------------------------------------------------------

const SQL = readFileSync(
  join(process.cwd(), 'scripts/marketing/023-marketing-content-preparation-and-run-readiness.sql'),
  'utf8',
)

// Executable SQL only — `-- ...` line comments stripped, so assertions about what
// the migration DOES are never satisfied (or tripped) by prose in the header,
// which legitimately names the neighbouring pipeline RPCs / the existing validator
// for documentation.
const CODE = SQL.replace(/--.*$/gm, '')

const VALIDATOR = 'wtf_marketing_content_snapshots_are_prepared'

describe('Stage 037 content-preparation + run-readiness migration (static)', () => {
  it('defines exactly the two NEW executor functions', () => {
    expect(SQL).toContain('CREATE OR REPLACE FUNCTION public.prepare_marketing_recipient_content')
    expect(SQL).toContain('CREATE OR REPLACE FUNCTION public.queue_prepared_marketing_runs')
  })

  it('DOES NOT define, replace, drop, or alter the EXISTING production validator', () => {
    // The validator already exists in production and is authoritative. This
    // migration must only CALL it — never (re)define or modify it. Check the
    // executable SQL so a documentation mention in comments cannot trip this.
    expect(CODE).not.toMatch(new RegExp(`CREATE\\s+FUNCTION\\s+public\\.${VALIDATOR}`, 'i'))
    expect(CODE).not.toMatch(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${VALIDATOR}`, 'i'))
    expect(CODE).not.toMatch(new RegExp(`DROP\\s+FUNCTION[\\s\\S]*${VALIDATOR}`, 'i'))
    expect(CODE).not.toMatch(new RegExp(`ALTER\\s+FUNCTION[\\s\\S]*${VALIDATOR}`, 'i'))
    // And it must not fiddle with the validator's grants either.
    expect(CODE).not.toMatch(new RegExp(`GRANT[\\s\\S]*${VALIDATOR}`, 'i'))
    expect(CODE).not.toMatch(new RegExp(`REVOKE[\\s\\S]*${VALIDATOR}`, 'i'))
  })

  it('creates no table, type, or column (no schema change)', () => {
    expect(SQL).not.toMatch(/CREATE\s+TABLE/i)
    expect(SQL).not.toMatch(/ALTER\s+TABLE/i)
    expect(SQL).not.toMatch(/CREATE\s+TYPE/i)
    expect(SQL).not.toMatch(/DROP\s+TABLE/i)
  })

  it('selects only preparation-eligible recipients from the shipped preview gate', () => {
    // Must reuse the Stage 022 preview rather than re-deriving eligibility.
    expect(SQL).toContain('wtf_marketing_recipient_preparation_preview')
    expect(SQL).toMatch(/preparation_eligible/)
  })

  it('preparation CALLS the existing validator before committing content', () => {
    // The preparation executor must call the validator and refuse to persist a
    // recipient whose snapshots do not satisfy the schemaVersion=1 contract.
    const prepBody = CODE.slice(CODE.indexOf('prepare_marketing_recipient_content'))
    expect(prepBody).toContain(VALIDATOR)
    // It gates the persistence on the boolean result (fail closed on NOT TRUE).
    expect(prepBody).toMatch(/IF\s+NOT\s+v_ok\s+THEN/i)
  })

  it('readiness relies on the SAME validated preparation gate (content_prepared)', () => {
    // Readiness never re-implements the contract; it aggregates content_prepared
    // (which itself embeds the validator's contract) from the shipped gate.
    const readyBody = CODE.slice(CODE.indexOf('queue_prepared_marketing_runs'))
    expect(readyBody).toContain('wtf_marketing_recipient_preparation_preview')
    expect(readyBody).toContain('content_prepared')
  })

  it('writes send-state columns to nothing (never sets sent_at / provider_email_id / status=sent)', () => {
    expect(SQL).not.toMatch(/sent_at\s*=/i)
    expect(SQL).not.toMatch(/provider_email_id\s*=/i)
    expect(SQL).not.toMatch(/status\s*=\s*'sent'/i)
    expect(SQL).not.toMatch(/status\s*=\s*'sending'/i)
  })

  it('never invokes discovery, materialisation, or delivery from within preparation/readiness', () => {
    // Assert against executable SQL (comments stripped): the header prose may name
    // the neighbouring RPCs for documentation, but no CODE path calls them.
    expect(CODE).not.toContain('discover_marketing_opportunities')
    expect(CODE).not.toContain('materialize_marketing_recipients')
    expect(CODE).not.toContain('claim_marketing_delivery_batch')
  })

  it('resolves the campaign URL against the FIXED canonical production base', () => {
    // Exactly https://www.wtf-giveaways.co.uk/giveaways/<slug>, constructed in CODE.
    expect(CODE).toContain('https://www.wtf-giveaways.co.uk')
    expect(CODE).toMatch(/'\/giveaways\/'\s*\|\|\s*c\.slug/)
  })

  it('has NO runtime URL configuration — no GUC / no current_setting / no settings helper', () => {
    expect(CODE).not.toContain('app.marketing_site_url')
    expect(CODE).not.toMatch(/current_setting/i)
    expect(CODE).not.toContain('wtf_marketing_site_base_url')
  })

  it('fully resolves both campaign placeholders (no residual mustache tokens persisted)', () => {
    expect(SQL).toContain('campaign_url')
    expect(SQL).toContain('campaign_title')
    // The executor must replace, not persist, the tokens.
    expect(CODE).toMatch(/regexp_replace\s*\(/i)
  })

  it('only transitions runs preparing -> queued, never backwards or to a send state', () => {
    const readyBody = CODE.slice(CODE.indexOf('queue_prepared_marketing_runs'))
    expect(readyBody).toContain("'queued'")
    expect(readyBody).toContain("'preparing'")
    expect(readyBody).not.toContain("'processing'")
    expect(readyBody).not.toContain("'completed'")
    expect(readyBody).not.toContain("'sent'")
  })

  it('marks a run ready only when it has no unprepared recipients remaining', () => {
    const readyBody = CODE.slice(CODE.indexOf('queue_prepared_marketing_runs'))
    // Every recipient prepared: prepared = total.
    expect(readyBody).toMatch(/prepared\s*=\s*total/i)
  })

  it('restricts EXECUTE to the service role and revokes public/anon/authenticated (NEW RPCs only)', () => {
    expect(SQL).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION[\s\S]*FROM\s+PUBLIC/i)
    expect(SQL).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*TO\s+service_role/i)
    expect(SQL).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*TO\s+anon/i)
  })

  it('runs both executors as SECURITY DEFINER with a pinned search_path', () => {
    expect(SQL).toMatch(/SECURITY\s+DEFINER/i)
    expect(SQL).toMatch(/SET\s+search_path/i)
  })

  it('accepts a bounded p_limit on both executors', () => {
    expect(SQL).toMatch(/prepare_marketing_recipient_content\s*\(\s*p_limit/i)
    expect(SQL).toMatch(/queue_prepared_marketing_runs\s*\(\s*p_limit/i)
  })

  it('does NOT reference the old readiness name mark_marketing_runs_ready', () => {
    expect(SQL).not.toContain('mark_marketing_runs_ready')
  })
})
