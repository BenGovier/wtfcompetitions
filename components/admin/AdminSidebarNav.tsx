"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Radio, Wallet, Users } from "lucide-react"
import { canAccessRoute, type AdminRole } from "@/lib/admin/permissions"

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/live-feed", label: "Live Feed" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/instant-wins", label: "Instant Wins" },
  { href: "/admin/entries", label: "Entries" },
  { href: "/admin/wallets", label: "WTF Credit" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/hosts", label: "Team Access" },
]

function isRouteActive(pathname: string, href: string): boolean {
  // "/admin" must match exactly, otherwise it would light up on every route.
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Reusable admin navigation link list. Shared by the fixed desktop sidebar and
 * the mobile slide-over drawer so both stay in sync. `onNavigate` lets the
 * drawer close itself after a link is tapped.
 */
export function AdminNavLinks({
  role,
  onNavigate,
}: {
  role: AdminRole
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  // Hosts (ops) only see the routes they can access; admins see everything.
  const visibleItems = navItems.filter((item) => canAccessRoute(role, item.href))

  return (
    <nav className="space-y-1 p-4">
      {visibleItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.href === "/admin/live-feed" && (
              <Radio className="mr-2 inline-block h-4 w-4" />
            )}
            {item.href === "/admin/wallets" && (
              <Wallet className="mr-2 inline-block h-4 w-4" />
            )}
            {item.href === "/admin/hosts" && (
              <Users className="mr-2 inline-block h-4 w-4" />
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Fixed sidebar — desktop only. On mobile the same links are rendered inside
 * the AdminShell slide-over drawer instead.
 */
export function AdminSidebarNav({ role }: { role: AdminRole }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <h2 className="text-lg font-semibold">WTF Admin</h2>
      </div>
      <AdminNavLinks role={role} />
    </aside>
  )
}
