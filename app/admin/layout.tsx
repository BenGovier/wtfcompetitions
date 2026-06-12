import React from "react"
import { AdminShell } from "@/components/admin/AdminShell"
import { requireAdmin } from "@/lib/admin/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Allow enabled admins and Hosts (ops) into the admin shell.
  // read_only / unknown roles are redirected to /auth/unauthorized.
  // Per-route admin-only restrictions are enforced inside each page.
  const { user, role } = await requireAdmin({ roles: ['admin', 'ops'] })

  return (
    <AdminShell user={user} role={role}>
      {children}
    </AdminShell>
  )
}
