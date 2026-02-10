import React from "react"
import { AdminShell } from "@/components/admin/AdminShell"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Verify user is authenticated and is admin
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/login?redirect=/admin')
  }
  
  const isAdmin = user.user_metadata?.is_admin === true
  if (!isAdmin) {
    redirect('/auth/unauthorized')
  }

  return <AdminShell user={user}>{children}</AdminShell>
}
