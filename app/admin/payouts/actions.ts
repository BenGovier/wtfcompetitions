'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ALLOWED_STATUSES = ['new', 'processing', 'paid', 'problem'] as const
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
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  
  if (authErr || !user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) {
    return { ok: false, error: 'Not authorized' }
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
    console.error('[payouts/actions] Update failed:', updateErr.message)
    return { ok: false, error: 'Failed to update status' }
  }

  // Revalidate the payouts page to show updated data
  revalidatePath('/admin/payouts')

  return { ok: true }
}
