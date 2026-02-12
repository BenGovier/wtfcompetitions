import React from "react"
import { AdminShell } from "@/components/admin/AdminShell"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  console.log('[admin] auth user_id=', user?.id, 'email=', user?.email, 'error=', !!error)

  if (error || !user) {
    redirect('/auth/login?redirect=/admin')
  }

  // Check if user is an enabled admin
  const { data: adminUser, error: adminErr } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .eq('is_enabled', true)
    .single()

  console.log('[admin] adminUser=', JSON.stringify(adminUser), 'adminErr=', JSON.stringify(adminErr))

  if (adminErr) {
    console.error('[admin] admin_users query failed', adminErr)
    redirect('/auth/unauthorized?reason=admin_query_failed')
  }

  if (!adminUser) {
    redirect('/auth/unauthorized?reason=not_admin')
  }

  if (!adminUser.role) {
    console.error('[admin] admin role missing', adminUser)
    redirect('/auth/unauthorized?reason=admin_role_missing')
  }

  return <AdminShell user={user}>{children}</AdminShell>
}
