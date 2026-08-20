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
  LayoutTemplate,
  Radio,
  Megaphone,
  Trophy,
  Zap,
  Tag,
  Ticket,
  Inbox,
  Wallet,
  Banknote,
  BarChart3,
  ScrollText,
  Users,
  UserSearch,
  Home,
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
 * The 14 VISIBLE admin navigation items.
 *
 * Order and grouping are authoritative; every item has exactly one icon.
 * Visibility is enforced by `canAccessRoute`, so admin-only items never surface
 * for operations_admin / ops regardless of section.
 *
 * NOTE: Marketing lives in the OPERATIONS section. Access is still admin-only
 * (enforced by `canAccessRoute`), so it never surfaces for operations_admin /
 * ops / read_only — but for Super Admins it is a first-class, visible nav item
 * rather than a hidden direct-URL-only route.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // OVERVIEW
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { href: '/admin/live-feed', label: 'Live Feed', icon: Radio, section: 'overview' },
  // OPERATIONS
  { href: '/admin/campaigns', label: 'Campaigns', icon: Trophy, section: 'operations' },
  { href: '/admin/homepage', label: 'Homepage', icon: LayoutTemplate, section: 'operations' },
  { href: '/admin/instant-wins', label: 'Instant Wins', icon: Zap, section: 'operations' },
  { href: '/admin/discount-codes', label: 'Discount Codes', icon: Tag, section: 'operations' },
  { href: '/admin/entries', label: 'Entries', icon: Ticket, section: 'operations' },
  { href: '/admin/customers', label: 'Customers', icon: UserSearch, section: 'operations' },
  { href: '/admin/inbox', label: 'Inbox', icon: Inbox, section: 'operations' },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, section: 'operations' },
  // FINANCE
  { href: '/admin/wallets', label: 'WTF Credit', icon: Wallet, section: 'finance' },
  { href: '/admin/payouts', label: 'Payouts', icon: Banknote, section: 'finance' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, section: 'finance' },
  // SYSTEM
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, section: 'system' },
  { href: '/admin/hosts', label: 'Team Access', icon: Users, section: 'system' },
]

/**
 * Host (ops) navigation — a deliberately tiny, streamlined set for the
 * mobile-first Host area. This is SEPARATE from the staff registry above so the
 * host experience stays focused (Home / Live Feed / My Comps) and the full
 * staff sidebar is never rendered for a Host.
 *
 * Every href here is inside HOST_ALLOWED_ROUTES, so server guards
 * (requireAdmin / canAccessRoute) authorise them for ops. Visibility is never
 * the security boundary — the pages and APIs enforce role server-side.
 */
export interface HostNavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const HOST_NAV_ITEMS: HostNavItem[] = [
  { href: '/admin/host', label: 'Home', icon: Home },
  { href: '/admin/live-feed', label: 'Live Feed', icon: Radio },
  { href: '/admin/host/comps', label: 'My Comps', icon: Trophy },
  { href: '/admin/host/earnings', label: 'Earnings', icon: Banknote },
]

/** Active-route test for the host nav (exact or descendant path). */
export function isHostNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Hidden admin routes.
 *
 * Pages reachable by direct URL for authorised admins but deliberately excluded
 * from every navigation surface. They participate ONLY in header label /
 * active-route resolution (never render a link or prefetch).
 *
 * This list is currently empty: Marketing was previously hidden here but has
 * been restored as a first-class OPERATIONS nav item (see ADMIN_NAV_ITEMS).
 * The export is retained so `resolveActiveNavItem` can still fold in any future
 * hidden routes without a signature change.
 */
export const ADMIN_HIDDEN_NAV_ITEMS: AdminNavItem[] = []

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
 *
 * Hidden routes (ADMIN_HIDDEN_NAV_ITEMS) are considered here for LABEL/active
 * resolution only — this function feeds the header title, never the rendered
 * navigation lists, so no hidden link or prefetch is produced.
 */
export function resolveActiveNavItem(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null
  let bestLen = -1
  for (const item of [...ADMIN_NAV_ITEMS, ...ADMIN_HIDDEN_NAV_ITEMS]) {
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
