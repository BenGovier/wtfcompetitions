"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Radio, Wallet } from "lucide-react"
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
  { href: "/admin/hosts", label: "Hosts" },
]

export function AdminSidebarNav({ role }: { role: AdminRole }) {
  const pathname = usePathname()

  // Hosts (ops) only see the routes they can access; admins see everything.
  const visibleItems = navItems.filter((item) => canAccessRoute(role, item.href))

  return (
    <aside className="w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <h2 className="text-lg font-semibold">WTF Admin</h2>
      </div>
      <nav className="space-y-1 p-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
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
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
