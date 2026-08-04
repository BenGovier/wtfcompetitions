import { describe, it, expect } from 'vitest'
import {
  ADMIN_NAV_ITEMS,
  ADMIN_HIDDEN_NAV_ITEMS,
  ADMIN_NAV_SECTIONS,
  getVisibleNavGroups,
  isNavItemActive,
  resolveActiveNavItem,
  resolveSectionLabel,
} from '@/lib/admin/navigation'
import { canAccessRoute, type AdminRole } from '@/lib/admin/permissions'

/**
 * Presentation-layer navigation registry tests.
 *
 * These assert the SHELL's visual contract (icons, grouping, active-route
 * resolution) AND that navigation visibility still exactly mirrors
 * `canAccessRoute`. They must fail loudly if the registry ever drifts from the
 * authoritative permission model or if a role's visible set changes.
 */

// The authoritative expected registry — order, labels, routes and sections.
// Locked here so any accidental reorder/rename/regroup is caught.
const EXPECTED = [
  { href: '/admin', label: 'Dashboard', section: 'overview' },
  { href: '/admin/live-feed', label: 'Live Feed', section: 'overview' },
  // Marketing is intentionally absent — it is a hidden route (see the dedicated
  // "hidden Marketing route" suite below), reachable only by direct URL.
  { href: '/admin/campaigns', label: 'Campaigns', section: 'operations' },
  { href: '/admin/instant-wins', label: 'Instant Wins', section: 'operations' },
  { href: '/admin/discount-codes', label: 'Discount Codes', section: 'operations' },
  { href: '/admin/entries', label: 'Entries', section: 'operations' },
  { href: '/admin/wallets', label: 'WTF Credit', section: 'finance' },
  { href: '/admin/payouts', label: 'Payouts', section: 'finance' },
  { href: '/admin/reports', label: 'Reports', section: 'finance' },
  { href: '/admin/audit-logs', label: 'Audit Logs', section: 'system' },
  { href: '/admin/hosts', label: 'Team Access', section: 'system' },
] as const

describe('admin nav registry', () => {
  it('contains exactly the 11 visible items in the expected order, labels and sections', () => {
    expect(ADMIN_NAV_ITEMS.map((i) => ({ href: i.href, label: i.label, section: i.section }))).toEqual(
      EXPECTED.map((e) => ({ href: e.href, label: e.label, section: e.section })),
    )
  })

  it('gives every item exactly one icon (a renderable component)', () => {
    expect(ADMIN_NAV_ITEMS).toHaveLength(11)
    for (const item of ADMIN_NAV_ITEMS) {
      // lucide icons are forwardRef objects or functions — both are valid.
      const t = typeof item.icon
      expect(t === 'function' || t === 'object', `${item.href} icon`).toBe(true)
      expect(item.icon, `${item.href} icon`).toBeTruthy()
    }
  })

  it('only uses known sections', () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(ADMIN_NAV_SECTIONS).toContain(item.section)
    }
  })
})

describe('isNavItemActive', () => {
  it('matches /admin (dashboard) exactly, never as a prefix', () => {
    expect(isNavItemActive('/admin', '/admin')).toBe(true)
    expect(isNavItemActive('/admin/campaigns', '/admin')).toBe(false)
    expect(isNavItemActive('/admin/reports', '/admin')).toBe(false)
  })

  it('matches other items on exact path or descendant', () => {
    expect(isNavItemActive('/admin/campaigns', '/admin/campaigns')).toBe(true)
    expect(isNavItemActive('/admin/campaigns/123', '/admin/campaigns')).toBe(true)
    expect(isNavItemActive('/admin/campaigns/123/tickets', '/admin/campaigns')).toBe(true)
    expect(isNavItemActive('/admin/entries', '/admin/campaigns')).toBe(false)
  })

  it('never marks more than one registry item active for any real route', () => {
    const routes = [
      '/admin',
      '/admin/live-feed',
      '/admin/live-feed/abc',
      '/admin/campaigns/123/tickets',
      '/admin/wallets/user-1',
      '/admin/discount-codes',
    ]
    for (const route of routes) {
      const activeCount = ADMIN_NAV_ITEMS.filter((i) => isNavItemActive(route, i.href)).length
      expect(activeCount, route).toBeLessThanOrEqual(1)
    }
  })
})

describe('resolveActiveNavItem (longest-prefix, nested routes)', () => {
  it('resolves nested routes to their nearest parent nav item', () => {
    expect(resolveActiveNavItem('/admin/campaigns/123/tickets')?.href).toBe('/admin/campaigns')
    expect(resolveActiveNavItem('/admin/live-feed/xyz')?.href).toBe('/admin/live-feed')
    expect(resolveActiveNavItem('/admin/wallets/user-1')?.href).toBe('/admin/wallets')
  })

  it('resolves the dashboard exactly', () => {
    expect(resolveActiveNavItem('/admin')?.href).toBe('/admin')
  })

  it('returns null for unmatched routes so the label can fall back', () => {
    expect(resolveActiveNavItem('/admin/does-not-exist')).toBeNull()
    expect(resolveSectionLabel('/admin/does-not-exist')).toBe('Admin')
    expect(resolveSectionLabel('/admin/campaigns/123')).toBe('Campaigns')
  })
})

describe('getVisibleNavGroups — visibility mirrors canAccessRoute exactly', () => {
  // Flatten helper.
  const hrefs = (role: AdminRole | null) => getVisibleNavGroups(role).flatMap((g) => g.items.map((i) => i.href))

  it('admin sees all 11 visible items across all 4 groups, in order', () => {
    const groups = getVisibleNavGroups('admin')
    expect(groups.map((g) => g.section)).toEqual(['overview', 'operations', 'finance', 'system'])
    expect(hrefs('admin')).toEqual(ADMIN_NAV_ITEMS.map((i) => i.href))
    // Even the super admin never sees Marketing in the navigation.
    expect(hrefs('admin')).not.toContain('/admin/marketing')
  })

  it('operations_admin sees exactly its authorised routes (no more, no less)', () => {
    expect(new Set(hrefs('operations_admin'))).toEqual(
      new Set([
        '/admin/live-feed',
        '/admin/instant-wins',
        '/admin/discount-codes',
        '/admin/entries',
        '/admin/wallets',
        '/admin/payouts',
      ]),
    )
    // Dashboard, marketing, campaigns, reports, audit logs, team access must NOT appear.
    for (const denied of [
      '/admin',
      '/admin/marketing',
      '/admin/campaigns',
      '/admin/reports',
      '/admin/audit-logs',
      '/admin/hosts',
    ]) {
      expect(hrefs('operations_admin')).not.toContain(denied)
    }
  })

  it('operations_admin does not render the (now-empty) system group', () => {
    const sections = getVisibleNavGroups('operations_admin').map((g) => g.section)
    expect(sections).not.toContain('system')
    // Overview only has Live Feed for this role (Dashboard hidden) but still renders.
    expect(sections).toContain('overview')
  })

  it('host (ops) sees only Live Feed, in a single group', () => {
    expect(hrefs('ops')).toEqual(['/admin/live-feed'])
    const groups = getVisibleNavGroups('ops')
    expect(groups).toHaveLength(1)
    expect(groups[0].section).toBe('overview')
  })

  it('read_only and null see NOTHING (no groups rendered)', () => {
    expect(getVisibleNavGroups('read_only')).toEqual([])
    expect(getVisibleNavGroups(null)).toEqual([])
  })

  it('never renders an empty group for any role', () => {
    for (const role of ['admin', 'operations_admin', 'ops', 'read_only', null] as (AdminRole | null)[]) {
      for (const group of getVisibleNavGroups(role)) {
        expect(group.items.length, `${role} / ${group.section}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('Marketing is hidden from navigation but reachable by direct URL', () => {
  const ROLES = ['admin', 'operations_admin', 'ops', 'read_only', null] as (AdminRole | null)[]
  const allVisibleHrefs = (role: AdminRole | null) =>
    getVisibleNavGroups(role).flatMap((g) => g.items.map((i) => i.href))

  it('is absent from the visible registry (desktop sidebar + mobile drawer share this source)', () => {
    // AdminSidebarNav (desktop) and AdminNavLinks (mobile drawer) both render
    // from getVisibleNavGroups(ADMIN_NAV_ITEMS), so one assertion covers both.
    expect(ADMIN_NAV_ITEMS.some((i) => i.href === '/admin/marketing')).toBe(false)
    expect(ADMIN_NAV_ITEMS.some((i) => i.label === 'Marketing')).toBe(false)
  })

  it('is absent from every generated navigation group, for every role', () => {
    for (const role of ROLES) {
      expect(allVisibleHrefs(role), `${role}`).not.toContain('/admin/marketing')
      // No group carries an item labelled Marketing either.
      const labels = getVisibleNavGroups(role).flatMap((g) => g.items.map((i) => i.label))
      expect(labels, `${role}`).not.toContain('Marketing')
    }
  })

  it('lives only in the hidden-route list (label metadata, renders no link/prefetch)', () => {
    expect(ADMIN_HIDDEN_NAV_ITEMS.map((i) => i.href)).toEqual(['/admin/marketing'])
    // Hidden items and visible items never overlap.
    const visible = new Set(ADMIN_NAV_ITEMS.map((i) => i.href))
    for (const hidden of ADMIN_HIDDEN_NAV_ITEMS) {
      expect(visible.has(hidden.href)).toBe(false)
    }
  })

  it('permissions are unchanged: admin may reach it, all other roles are denied', () => {
    // Route permissions are untouched by hiding the nav item.
    expect(canAccessRoute('admin', '/admin/marketing')).toBe(true)
    for (const denied of ['operations_admin', 'ops', 'read_only', null] as (AdminRole | null)[]) {
      expect(canAccessRoute(denied, '/admin/marketing'), `${denied}`).toBe(false)
    }
  })

  it('still resolves the header label so a direct-URL visit is titled "Marketing"', () => {
    expect(resolveActiveNavItem('/admin/marketing')?.label).toBe('Marketing')
    expect(resolveSectionLabel('/admin/marketing')).toBe('Marketing')
    // Nested marketing routes resolve to the same label.
    expect(resolveSectionLabel('/admin/marketing/anything')).toBe('Marketing')
  })
})
