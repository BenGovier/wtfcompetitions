'use client'

import React, { useState } from "react"
import Link from "next/link"
import { AdminSidebarNav, AdminNavLinks } from "./AdminSidebarNav"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LogOut, Menu } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import type { AdminRole } from "@/lib/admin/permissions"

export function AdminShell({
  children,
  user,
  role,
}: {
  children: React.ReactNode
  user: User
  role: AdminRole
}) {
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen">
      {/* Desktop fixed sidebar (hidden on mobile) */}
      <AdminSidebarNav role={role} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile admin header — compact, sticky, admin-only chrome */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 md:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2" aria-label="Open admin menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="text-lg">WTF Admin</SheetTitle>
              </SheetHeader>
              <AdminNavLinks role={role} onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <span className="text-base font-semibold">WTF Admin</span>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        {/* Desktop header (hidden on mobile) */}
        <header className="hidden h-16 items-center justify-between border-b border-border bg-card px-6 md:flex">
          <h1 className="text-xl font-semibold">WTF Giveaways Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View site
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/30">
          <div className="mx-auto w-full min-w-0 max-w-[1800px] px-4 py-4 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
