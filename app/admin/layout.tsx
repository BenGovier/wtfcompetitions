import React from "react"
import { AdminShell } from "@/components/admin/AdminShell"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log('ADMIN_LAYOUT_SUPABASE_ENV', {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
    SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'missing'
  })
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  console.log('[admin] user=', user?.id, user?.email, 'authErr=', !!error)

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

  console.log('[admin] adminUser=', adminUser)
  if (adminErr) console.error('[admin] admin_users query error', adminErr)

  if (!adminUser || adminUser.is_enabled !== true) {
    redirect('/auth/unauthorized')
  }

  return <AdminShell user={user}>{children}</AdminShell>
}
