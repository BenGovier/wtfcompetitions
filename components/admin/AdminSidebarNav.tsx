"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { AdminRole } from "@/lib/admin/permissions"
import { getVisibleNavGroups, isNavItemActive } from "@/lib/admin/navigation"

/**
 * Reusable admin navigation list. Shared by the fixed desktop sidebar and the
 * mobile slide-over drawer so both render from the same registry and stay in
 * sync. `onNavigate` lets the drawer close itself after a link is tapped.
 *
 * Visibility is delegated to `getVisibleNavGroups` -> `canAccessRoute`; this
 * component never decides access on its own.
 */
export function AdminNavLinks({
  role,
  onNavigate,
}: {
  role: AdminRole
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const groups = getVisibleNavGroups(role)

  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Admin">
      {groups.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-foreground/70 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {/* Left accent bar — a non-colour-only active cue alongside aria-current. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {/* Fixed-width icon column keeps every label aligned. */}
                    <Icon
                      aria-hidden="true"
                      strokeWidth={2}
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * Fixed sidebar — desktop only. On mobile the same links render inside the
 * AdminShell slide-over drawer instead. The nav area scrolls independently so
 * the brand header stays pinned on short viewports.
 */
export function AdminSidebarNav({ role }: { role: AdminRole }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-primary-foreground"
        >
          WTF
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-foreground">Admin Portal</span>
          <span className="block text-xs text-muted-foreground">WTF Giveaways</span>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AdminNavLinks role={role} />
      </div>
    </aside>
  )
}
