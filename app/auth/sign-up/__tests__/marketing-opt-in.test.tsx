// @vitest-environment jsdom
//
// Focused tests for the signup marketing-consent checkbox. These run in a
// jsdom environment (scoped to THIS file via the pragma above) so the rest of
// the suite keeps using the project's default `node` environment.
//
// They confirm the three behaviours the product requires:
//   1. The checkbox renders CHECKED on the initial signup screen.
//   2. Leaving it checked carries marketing_opt_in: true into the signUp call
//      (the callback then saves the preference with source 'signup' + version).
//   3. The customer can UNTICK it, in which case marketing_opt_in is false and
//      signup STILL succeeds (consent never blocks account creation).

import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MARKETING_CONSENT_LABEL } from '@/lib/marketing/consent'

// jsdom does not implement ResizeObserver, which Radix's checkbox references.
// Provide a no-op stub so the component can mount.
if (!(globalThis as any).ResizeObserver) {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Capture every signUp call so we can assert the metadata it received.
const signUpMock = vi.fn(async () => ({
  // Email-confirmation flow: no session yet, user not confirmed -> the page
  // shows the "Check your email" success screen (i.e. signup succeeded).
  data: { session: null, user: { confirmed_at: null } },
  error: null,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}))

// next/link -> plain anchor so no router runtime is needed.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

import SignUpPage from '../page'

afterEach(() => {
  cleanup()
  signUpMock.mockClear()
})

function getMarketingCheckbox() {
  return screen.getByRole('checkbox', { name: MARKETING_CONSENT_LABEL })
}

// Radix's checkbox is a <button role="checkbox"> that reflects state via
// aria-checked; assert on that rather than relying on jest-dom matchers (which
// this repo does not configure).
function isChecked(el: HTMLElement) {
  return el.getAttribute('aria-checked') === 'true'
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Jane')
  await user.type(screen.getByLabelText(/last name/i), 'Doe')
  await user.type(screen.getByLabelText(/mobile number/i), '+44 7700 900000')
  await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com')
  await user.type(screen.getByLabelText(/^password$/i), 'supersecret')
}

describe('signup marketing consent checkbox', () => {
  it('renders checked by default on the initial signup screen', () => {
    render(<SignUpPage />)
    expect(isChecked(getMarketingCheckbox())).toBe(true)
  })

  it('keeps marketing_opt_in true when left checked and signup succeeds', async () => {
    const user = userEvent.setup()
    render(<SignUpPage />)

    expect(isChecked(getMarketingCheckbox())).toBe(true)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create free account/i }))

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1))
    expect(signUpMock.mock.calls[0][0].options.data.marketing_opt_in).toBe(true)

    // Signup succeeded -> confirmation screen is shown.
    expect(await screen.findByText(/check your email/i)).toBeTruthy()
  })

  it('lets the customer untick it, sending marketing_opt_in false while signup still succeeds', async () => {
    const user = userEvent.setup()
    render(<SignUpPage />)

    const checkbox = getMarketingCheckbox()
    expect(isChecked(checkbox)).toBe(true)

    // Manually untick before submitting.
    await user.click(checkbox)
    expect(isChecked(checkbox)).toBe(false)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create free account/i }))

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1))
    expect(signUpMock.mock.calls[0][0].options.data.marketing_opt_in).toBe(false)

    // Signup still succeeds even with consent declined.
    expect(await screen.findByText(/check your email/i)).toBeTruthy()
  })
})
