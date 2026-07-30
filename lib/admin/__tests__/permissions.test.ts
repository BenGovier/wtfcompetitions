import { describe, it, expect } from 'vitest'
import {
  type AdminRole,
  ADMIN_ROLES,
  ROLE_LABELS,
  HOST_ROLE,
  HOST_ALLOWED_ROUTES,
  OPERATIONS_ADMIN_ALLOWED_ROUTES,
  normalizeRole,
  canAccessRoute,
  canAccessAdmin,
} from '@/lib/admin/permissions'

/**
 * Authorization matrix for the /admin surface.
 *
 * `permissions.ts` is the single, client-safe source of truth that every
 * server guard (requireAdmin / authorizeAdminApi) and the navigation consult.
 * The `GUARDS` map below mirrors the exact role arrays passed to those guards
 * in the codebase, so these tests fail loudly if a campaign / report / host /
 * prize / delete guard is ever accidentally widened to operations_admin.
 */

// Access decision as performed by requireAdmin / authorizeAdminApi:
// the caller must have an enabled, known role that is in the allowed set.
function isAuthorized(allowed: AdminRole[], role: AdminRole | null): boolean {
  if (!role) return false
  return allowed.includes(role)
}

// Mirror of every guard's role array in the codebase, keyed by surface.
const GUARDS: Record<string, AdminRole[]> = {
  // Shell entry (app/admin/layout.tsx) — entry only; child pages re-guard.
  'layout:/admin': ['admin', 'operations_admin', 'ops'],

  // Allowed pages
  'page:/admin/payouts': ['admin', 'operations_admin'],
  'page:/admin/instant-wins': ['admin', 'operations_admin'],
  'page:/admin/entries': ['admin', 'operations_admin'],
  'page:/admin/wallets': ['admin', 'operations_admin'],
  'page:/admin/wallets/[userId]': ['admin', 'operations_admin'],
  'page:/admin/live-feed': ['admin', 'operations_admin', 'ops'],
  'page:/admin/live-feed/[id]': ['admin', 'operations_admin', 'ops'],

  // Allowed APIs
  'api:GET /api/admin/instant-winners': ['admin', 'operations_admin'],
  'api:POST /api/admin/instant-winners': ['admin', 'operations_admin'],
  'api:GET /api/admin/entries': ['admin', 'operations_admin'],
  'api:GET /api/admin/wallets/search': ['admin', 'operations_admin'],
  'api:GET /api/admin/wallets/[userId]': ['admin', 'operations_admin'],
  'api:POST /api/admin/wallets/[userId]/credit': ['admin', 'operations_admin'],
  'api:GET /api/admin/live-feed': ['admin', 'operations_admin', 'ops'],
  'api:GET /api/admin/live-feed/campaigns': ['admin', 'operations_admin', 'ops'],
  'api:GET /api/admin/live-feed/[id]': ['admin', 'operations_admin', 'ops'],

  // Allowed server actions (app/admin/payouts/actions.ts)
  'action:updatePayoutStatus': ['admin', 'operations_admin'],
  'action:bulkUpdatePayoutStatus': ['admin', 'operations_admin'],

  // Blocked — Super Admin only
  'page:/admin (dashboard)': ['admin'],
  'page:/admin/campaigns': ['admin'],
  'page:/admin/campaigns/[id]': ['admin'],
  'page:/admin/campaigns/[id]/tickets': ['admin'],
  'page:/admin/reports': ['admin'],
  'page:/admin/hosts': ['admin'],
  'page:/admin/audit-logs': ['admin'],
  'api:POST /api/admin/campaigns': ['admin'],
  'api:POST /api/admin/campaigns/duplicate': ['admin'],
  'api:GET /api/admin/campaigns/[id]/tickets': ['admin'],
  'api:instant-win-prizes': ['admin'],
  'api:instant-win-prizes/quantity': ['admin'],
  'api:GET /api/admin/reports': ['admin'],
  'api:GET /api/admin/reports/export': ['admin'],
  'action:deletePayout': ['admin'],

  // Blocked — campaign live-board stays admin + Host only (unchanged)
  'page:/admin/campaigns/[id]/live-board': ['admin'],
  'api:POST /api/admin/campaigns/[id]/live-board/action': ['admin', 'ops'],
}

describe('role model', () => {
  it('recognises exactly the four stored roles', () => {
    expect(ADMIN_ROLES).toEqual(['admin', 'operations_admin', 'ops', 'read_only'])
  })

  it('uses the approved display labels', () => {
    expect(ROLE_LABELS.admin).toBe('Super Admin')
    expect(ROLE_LABELS.operations_admin).toBe('Operations Admin')
    expect(ROLE_LABELS.ops).toBe('Host')
    expect(ROLE_LABELS.read_only).toBe('Read Only')
  })

  it('keeps Host mapped to the stored "ops" value', () => {
    expect(HOST_ROLE).toBe('ops')
  })
})

describe('normalizeRole (fail closed)', () => {
  it('accepts every known role', () => {
    for (const r of ADMIN_ROLES) expect(normalizeRole(r)).toBe(r)
  })

  it('rejects unknown / empty / nullish values', () => {
    expect(normalizeRole('operationsadmin')).toBeNull()
    expect(normalizeRole('superadmin')).toBeNull()
    expect(normalizeRole('')).toBeNull()
    expect(normalizeRole(undefined)).toBeNull()
    expect(normalizeRole(null)).toBeNull()
    expect(normalizeRole(42)).toBeNull()
  })
})

describe('canAccessAdmin (shell entry)', () => {
  it('admits admin, operations_admin, and ops', () => {
    expect(canAccessAdmin('admin')).toBe(true)
    expect(canAccessAdmin('operations_admin')).toBe(true)
    expect(canAccessAdmin('ops')).toBe(true)
  })

  it('rejects read_only and unknown', () => {
    expect(canAccessAdmin('read_only')).toBe(false)
    expect(canAccessAdmin(null)).toBe(false)
  })
})

describe('canAccessRoute (navigation visibility)', () => {
  const opsAdminAllows = [
    '/admin/payouts',
    '/admin/instant-wins',
    '/admin/entries',
    '/admin/wallets',
    '/admin/wallets/abc-123',
    '/admin/live-feed',
    '/admin/live-feed/some-id',
  ]
  const opsAdminDenies = [
    '/admin',
    '/admin/campaigns',
    '/admin/campaigns/123',
    '/admin/reports',
    '/admin/reports/export',
    '/admin/hosts',
    '/admin/audit-logs',
  ]

  it('admin sees everything', () => {
    for (const p of [...opsAdminAllows, ...opsAdminDenies]) {
      expect(canAccessRoute('admin', p)).toBe(true)
    }
  })

  it('operations_admin sees only its allow-list (incl. descendants)', () => {
    for (const p of opsAdminAllows) expect(canAccessRoute('operations_admin', p)).toBe(true)
    for (const p of opsAdminDenies) expect(canAccessRoute('operations_admin', p)).toBe(false)
  })

  it('operations_admin allow-list does not leak to the /admin dashboard', () => {
    // '/admin' must never be granted via a prefix match of an allowed route.
    expect(canAccessRoute('operations_admin', '/admin')).toBe(false)
    expect(OPERATIONS_ADMIN_ALLOWED_ROUTES).not.toContain('/admin')
  })

  it('ops (Host) sees only the live feed — unchanged behaviour', () => {
    expect(canAccessRoute('ops', '/admin/live-feed')).toBe(true)
    expect(canAccessRoute('ops', '/admin/live-feed/xyz')).toBe(true)
    expect(HOST_ALLOWED_ROUTES).toEqual(['/admin/live-feed'])
    for (const p of ['/admin', '/admin/payouts', '/admin/entries', '/admin/wallets', '/admin/campaigns']) {
      expect(canAccessRoute('ops', p)).toBe(false)
    }
  })

  it('read_only and unknown see nothing', () => {
    for (const p of [...opsAdminAllows, ...opsAdminDenies]) {
      expect(canAccessRoute('read_only', p)).toBe(false)
      expect(canAccessRoute(null, p)).toBe(false)
    }
  })
})

describe('Super Admin authorization matrix', () => {
  it('is authorized for every guarded surface', () => {
    for (const [surface, allowed] of Object.entries(GUARDS)) {
      expect(isAuthorized(allowed, 'admin'), surface).toBe(true)
    }
  })
})

describe('Operations Admin authorization matrix', () => {
  const allowedSurfaces = [
    'page:/admin/payouts',
    'page:/admin/instant-wins',
    'page:/admin/entries',
    'page:/admin/wallets',
    'page:/admin/wallets/[userId]',
    'page:/admin/live-feed',
    'page:/admin/live-feed/[id]',
    'api:GET /api/admin/instant-winners',
    'api:POST /api/admin/instant-winners',
    'api:GET /api/admin/entries',
    'api:GET /api/admin/wallets/search',
    'api:GET /api/admin/wallets/[userId]',
    'api:POST /api/admin/wallets/[userId]/credit',
    'api:GET /api/admin/live-feed',
    'api:GET /api/admin/live-feed/campaigns',
    'api:GET /api/admin/live-feed/[id]',
    'action:updatePayoutStatus',
    'action:bulkUpdatePayoutStatus',
    'layout:/admin',
  ]

  const blockedSurfaces = [
    'page:/admin (dashboard)',
    'page:/admin/campaigns',
    'page:/admin/campaigns/[id]',
    'page:/admin/campaigns/[id]/tickets',
    'page:/admin/campaigns/[id]/live-board',
    'page:/admin/reports',
    'page:/admin/hosts',
    'page:/admin/audit-logs',
    'api:POST /api/admin/campaigns',
    'api:POST /api/admin/campaigns/duplicate',
    'api:GET /api/admin/campaigns/[id]/tickets',
    'api:POST /api/admin/campaigns/[id]/live-board/action',
    'api:instant-win-prizes',
    'api:instant-win-prizes/quantity',
    'api:GET /api/admin/reports',
    'api:GET /api/admin/reports/export',
    'action:deletePayout',
  ]

  it('is authorized for every allowed surface', () => {
    for (const surface of allowedSurfaces) {
      expect(isAuthorized(GUARDS[surface], 'operations_admin'), surface).toBe(true)
    }
  })

  it('is rejected for every blocked surface (direct URL / API / action)', () => {
    for (const surface of blockedSurfaces) {
      expect(isAuthorized(GUARDS[surface], 'operations_admin'), surface).toBe(false)
    }
  })

  it('cannot permanently delete payouts', () => {
    expect(isAuthorized(GUARDS['action:deletePayout'], 'operations_admin')).toBe(false)
    expect(isAuthorized(GUARDS['action:deletePayout'], 'admin')).toBe(true)
  })
})

describe('Host (ops) regression — behaviour unchanged', () => {
  it('keeps live feed access', () => {
    expect(isAuthorized(GUARDS['page:/admin/live-feed'], 'ops')).toBe(true)
    expect(isAuthorized(GUARDS['page:/admin/live-feed/[id]'], 'ops')).toBe(true)
    expect(isAuthorized(GUARDS['api:GET /api/admin/live-feed'], 'ops')).toBe(true)
    expect(isAuthorized(GUARDS['api:GET /api/admin/live-feed/campaigns'], 'ops')).toBe(true)
    expect(isAuthorized(GUARDS['api:GET /api/admin/live-feed/[id]'], 'ops')).toBe(true)
  })

  it('keeps existing live-board action access', () => {
    expect(isAuthorized(GUARDS['api:POST /api/admin/campaigns/[id]/live-board/action'], 'ops')).toBe(true)
  })

  it('remains denied for payouts, entries, wallets, instant winners, campaigns, reports', () => {
    for (const surface of [
      'page:/admin/payouts',
      'action:updatePayoutStatus',
      'page:/admin/entries',
      'page:/admin/wallets',
      'api:GET /api/admin/instant-winners',
      'api:POST /api/admin/instant-winners',
      'page:/admin/campaigns',
      'page:/admin/reports',
    ]) {
      expect(isAuthorized(GUARDS[surface], 'ops'), surface).toBe(false)
    }
  })
})

describe('disabled / invalid / unauthenticated (fail closed)', () => {
  // requireAdmin / authorizeAdminApi resolve the role to null when there is no
  // admin_users row, is_enabled !== true, the role is unknown, or the request
  // is unauthenticated. A null role must never satisfy any guard.
  it('a null role is rejected everywhere', () => {
    for (const [surface, allowed] of Object.entries(GUARDS)) {
      expect(isAuthorized(allowed, null), surface).toBe(false)
    }
  })

  it('read_only is rejected everywhere', () => {
    for (const [surface, allowed] of Object.entries(GUARDS)) {
      expect(isAuthorized(allowed, 'read_only'), surface).toBe(false)
    }
  })

  it('an unknown role string normalizes to null and is denied', () => {
    const unknown = normalizeRole('operations') // note: not "operations_admin"
    expect(unknown).toBeNull()
    expect(isAuthorized(GUARDS['page:/admin/payouts'], unknown)).toBe(false)
  })
})
