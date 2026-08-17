import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const authorizeAdminApi = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  authorizeAdminApi: (...args: unknown[]) => authorizeAdminApi(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ __userScoped: true })),
}))

const runStage032Canary = vi.fn()
vi.mock('@/lib/marketing/stage-032-canary', () => ({
  runStage032Canary: (...args: unknown[]) => runStage032Canary(...args),
}))

import { POST } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Stage 032 — admin canary route authorization', () => {
  it('1. unauthenticated request => 401 and worker/orchestrator NOT called', async () => {
    authorizeAdminApi.mockResolvedValue({ user: null, role: null, error: 'Not authenticated' })
    const res = await POST()
    expect(res.status).toBe(401)
    expect(runStage032Canary).not.toHaveBeenCalled()
  })

  it('2. unauthorized admin role => 403 and orchestrator NOT called', async () => {
    authorizeAdminApi.mockResolvedValue({ user: null, role: 'ops', error: 'Not authorized' })
    const res = await POST()
    expect(res.status).toBe(403)
    expect(runStage032Canary).not.toHaveBeenCalled()
  })

  it('authorized admin => orchestrator called with NO client-supplied input', async () => {
    authorizeAdminApi.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin', error: null })
    runStage032Canary.mockResolvedValue({
      ok: true,
      status: 'ok',
      claimedCount: 1,
      sentCount: 1,
      failedCount: 0,
      recipient: 'ben@naay.co.uk',
    })
    const res = await POST()
    expect(res.status).toBe(200)
    // 10. Route passes NO arguments — recipient is hard-coded server-side.
    expect(runStage032Canary).toHaveBeenCalledTimes(1)
    expect(runStage032Canary).toHaveBeenCalledWith()
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, recipient: 'ben@naay.co.uk' })
  })

  it('preflight failure surfaces as 409 without leaking internals', async () => {
    authorizeAdminApi.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin', error: null })
    runStage032Canary.mockResolvedValue({ ok: false, error: 'preflight_failed', check: 'control_mismatch' })
    const res = await POST()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: 'preflight_failed', check: 'control_mismatch' })
  })
})
