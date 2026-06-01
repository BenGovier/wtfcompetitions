'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ALLOWED_STATUSES = ['new', 'in_progress', 'paid', 'problem'] as const
type PayoutStatus = (typeof ALLOWED_STATUSES)[number]

/**
 * Server action to update payout status.
 * - Validates status against allowed values
 * - Verifies admin authorization
 * - Uses service role key server-side only
 * - Updates status, status_updated_at, and status_updated_by
 */
export async function updatePayoutStatus(
  id: string,
  status: PayoutStatus
): Promise<{ ok: boolean; error?: string }> {
  // Validate status
  if (!ALLOWED_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status' }
  }

  // Validate id format (basic UUID check)
  if (!id || typeof id !== 'string' || id.length < 10) {
    return { ok: false, error: 'Invalid payout ID' }
  }

  // Auth check - verify current user is an enabled admin
  let user
  try {
    const supabase = await createClient()
    const { data, error: authErr } = await supabase.auth.getUser()
    
    if (authErr) {
      console.error('[payouts/actions] Auth error:', authErr.message)
      return { ok: false, error: 'Authentication failed' }
    }
    
    if (!data?.user) {
      console.error('[payouts/actions] No user in session')
      return { ok: false, error: 'Not authenticated - please log in again' }
    }
    
    user = data.user

    const { data: adminRow, error: adminErr } = await supabase
      .from('admin_users')
      .select('role,is_enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminErr) {
      console.error('[payouts/actions] Admin lookup error:', adminErr.message)
      return { ok: false, error: 'Failed to verify admin status' }
    }

    if (!adminRow || adminRow.is_enabled !== true) {
      console.error('[payouts/actions] User not admin or not enabled:', user.id)
      return { ok: false, error: 'Not authorized as admin' }
    }
  } catch (err) {
    console.error('[payouts/actions] Unexpected auth error:', err)
    return { ok: false, error: 'Authentication error' }
  }

  // Get service role client for update (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[payouts/actions] Missing Supabase credentials')
    return { ok: false, error: 'Server configuration error' }
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Update the payout status
  const { error: updateErr } = await serviceClient
    .from('contact_enquiries')
    .update({
      status,
      status_updated_at: new Date().toISOString(),
      status_updated_by: user.id,
    })
    .eq('id', id)
    .eq('enquiry_type', 'winner_payout') // Safety: only update winner_payout records

  if (updateErr) {
    console.error('[payouts/actions] Update failed:', updateErr.message, updateErr.code)
    return { ok: false, error: `Database update failed: ${updateErr.code || 'unknown'}` }
  }

  // Revalidate the payouts page to show updated data
  revalidatePath('/admin/payouts')

  return { ok: true }
}
