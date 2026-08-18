// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Stage032CanaryButton } from '../Stage032CanaryButton'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
})

describe('Stage 032 — canary button', () => {
  it('3/4. rendering does NOT trigger any preflight/worker request', () => {
    render(<Stage032CanaryButton />)
    expect(screen.getByRole('heading', { name: 'Run Stage 032 Canary' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run Stage 032 Canary' })).toBeTruthy()
    // Merely viewing the control makes ZERO network calls.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation; Cancel makes no request', () => {
    render(<Stage032CanaryButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Run Stage 032 Canary' }))
    expect(screen.getByText('Send the Stage 032 canary to ben@naay.co.uk only?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Send Canary makes exactly ONE POST and does not auto-retry', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: 'ok', claimedCount: 1, sentCount: 1, failedCount: 0, recipient: 'ben@naay.co.uk' }),
    })
    render(<Stage032CanaryButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Run Stage 032 Canary' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send Canary' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/marketing/stage-032-canary',
      expect.objectContaining({ method: 'POST' }),
    )
    // Give any (forbidden) retry a chance — count must stay at 1.
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
