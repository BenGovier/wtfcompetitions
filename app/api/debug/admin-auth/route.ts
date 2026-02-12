import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('DEBUG_ROUTE_SUPABASE_ENV', {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
    SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'missing'
  })
  const headerStore = await headers()
  const cookieHeader = headerStore.get('cookie')

  const hasCookieHeader = !!cookieHeader
  const cookieHeaderLength = cookieHeader?.length ?? 0

  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  let adminRow: { role: string; is_enabled: boolean } | null = null
  let adminError: unknown = null

  if (user) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('role, is_enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    adminRow = data
    adminError = error
  }

  return NextResponse.json({
    hasCookieHeader,
    cookieHeaderLength,
    user: user ? { id: user.id, email: user.email } : null,
    userError: userError ?? null,
    adminRow,
    adminError,
  })
}
