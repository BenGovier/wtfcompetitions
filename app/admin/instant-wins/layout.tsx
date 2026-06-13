import React from "react"
import { requireAdmin } from "@/lib/admin/auth"

export default async function InstantWinsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Admin-only segment. Hosts (ops) are redirected to /auth/unauthorized.
  await requireAdmin({ roles: ['admin'] })
  return <>{children}</>
}
