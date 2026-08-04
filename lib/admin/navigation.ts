/**
 * Central admin navigation registry.
 *
 * This is the single source of truth for the admin sidebar and mobile drawer:
 * every item carries its route, label, icon, and visual section directly. Both
 * the desktop sidebar and the mobile drawer render from the SAME registry via
 * `getVisibleNavGroups`, so they can never drift.
 *
 * IMPORTANT:
 *  - This module is client-safe. It must NOT import server-only modules.
 *  - It is a USABILITY control only. Actual authorization is enforced server
 *    side by requireAdmin / authorizeAdminApi. Visibility here is always
 *    filtered through `canAccessRoute` (the same function the guards mirror),
 *    and this file never widens or narrows any role's access.
 *  - The pure helpers (grouping + active-route resolution) contain no React and
 *    are unit-tested in the Node test environment.
 */
import {
  LayoutDashboard,
  Radio,
  Megaphone,
  Trophy,
  Zap,
  Tag,
  Ticket,
  Wallet,
  Banknote,
  BarChart3,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { canAccessRoute, type AdminRole } from '@/lib/admin/permissions'

/** Visual grouping sections, in display order. */
export type AdminNavSection = 'overview' | 'operations' | 'finance' | 'system'

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = ['overview', 'operations', 'finance', 'system']

/** Small, muted, uppercase heading text for each section. */
export const ADMIN_SECTION_LABELS: Record<AdminNavSection, string> = {
  overview: 'Overview',
  operations: 'Operations',
  finance: 'Finance',
  system: 'System',
}

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
  section: AdminNavSection
}

/**
 * The 12 admin navigation items.
 *
 * Order and grouping are authoritative; every item has exactly one icon.
 * Visibility is enforced by `canAccessRoute`, so admin-only items (e.g.
 * Marketing) never surface for operations_admin / ops regardless of section.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // OVERVIEW
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { href: '/admin/live-feed', label: 'Live Feed', icon: Radio, section: 'overview' },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, section: 'overview' },
  // OPERATIONS
  { href: '/admin/campaigns', label: 'Campaigns', icon: Trophy, section: 'operations' },
  { href: '/admin/instant-wins', label: 'Instant Wins', icon: Zap, section: 'operations' },
  { href: '/admin/discount-codes', label: 'Discount Codes', icon: Tag, section: 'operations' },
  { href: '/admin/entries', label: 'Entries', icon: Ticket, section: 'operations' },
  // FINANCE
  { href: '/admin/wallets', label: 'WTF Credit', icon: Wallet, section: 'finance' },
  { href: '/admin/payouts', label: 'Payouts', icon: Banknote, section: 'finance' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, section: 'finance' },
  // SYSTEM
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, section: 'system' },
  { href: '/admin/hosts', label: 'Team Access', icon: Users, section: 'system' },
]

/**
 * Active-route test for sidebar highlighting.
 *
 * "/admin" must match EXACTLY (otherwise it would light up on every route,
 * since it is a prefix of them all). Every other item matches its own path or
 * any descendant. No two non-dashboard hrefs are prefixes of one another, so at
 * most one item is ever active.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AdminNavGroup {
  section: AdminNavSection
  label: string
  items: AdminNavItem[]
}

/**
 * Groups the role-visible items by section, preserving registry order and
 * dropping any section with no visible items. Visibility is delegated entirely
 * to `canAccessRoute` — this function never changes access.
 */
export function getVisibleNavGroups(role: AdminRole | null): AdminNavGroup[] {
  const visible = ADMIN_NAV_ITEMS.filter((item) => canAccessRoute(role, item.href))
  return ADMIN_NAV_SECTIONS.map((section) => ({
    section,
    label: ADMIN_SECTION_LABELS[section],
    items: visible.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0)
}

/**
 * Resolves the nav item that best represents the current pathname, using
 * longest-prefix matching so nested routes (e.g. /admin/campaigns/123/tickets)
 * resolve to their nearest parent nav item (/admin/campaigns). Returns null
 * when nothing matches so callers can fall back to a safe default label.
 */
export function resolveActiveNavItem(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null
  let bestLen = -1
  for (const item of ADMIN_NAV_ITEMS) {
    if (isNavItemActive(pathname, item.href) && item.href.length > bestLen) {
      best = item
      bestLen = item.href.length
    }
  }
  return best
}

/**
 * Compact section/page label for the header. Falls back to "Admin" for any
 * route that has no matching nav item.
 */
export function resolveSectionLabel(pathname: string): string {
  return resolveActiveNavItem(pathname)?.label ?? 'Admin'
}
