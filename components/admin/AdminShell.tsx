import React from "react"
import Link from "next/link"
import { AdminSidebarNav } from "./AdminSidebarNav"

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <AdminSidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-xl font-semibold">WTF Giveaways Admin</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View site
          </Link>
        </header>
        <main className="flex-1 overflow-auto bg-muted/30">
          <div className="container max-w-7xl py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
