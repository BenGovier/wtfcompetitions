/**
 * Shared Admin → Inbox contract types.
 *
 * These mirror the LIVE database contract for `contact_enquiries` and
 * `contact_enquiry_messages` exactly (Phase 1). Nothing here invents columns or
 * RPCs — every field corresponds to a column/RPC output that already exists in
 * Supabase.
 *
 * IMPORTANT: the support workflow uses `inbox_status` ONLY. The legacy
 * `contact_enquiries.status` (new / paid / problem) belongs to the payout
 * workflow and is never read or written by the Inbox.
 */

/** The three Inbox support statuses. Independent of `contact_enquiries.status`. */
export const INBOX_STATUSES = ['open', 'waiting', 'resolved'] as const
export type InboxStatus = (typeof INBOX_STATUSES)[number]

/** The status filter values accepted by the list API (adds "all"). */
export const INBOX_STATUS_FILTERS = ['open', 'waiting', 'resolved', 'all'] as const
export type InboxStatusFilter = (typeof INBOX_STATUS_FILTERS)[number]

/** Existing enquiry types (from the live contact form contract). */
export const ENQUIRY_TYPES = [
  'general',
  'winner_payout',
  'ticket_order_problem',
  'account_login_issue',
  'other',
] as const
export type EnquiryType = (typeof ENQUIRY_TYPES)[number]

/** Message direction (contact_enquiry_messages.direction). */
export type MessageDirection = 'inbound' | 'outbound'

/** Outbound email lifecycle (contact_enquiry_messages.email_status). */
export const EMAIL_STATUSES = ['pending', 'sent', 'failed', 'not_required'] as const
export type EmailStatus = (typeof EMAIL_STATUSES)[number]

/** A single row in the Inbox list (only what the list needs — no conversation,
 *  no orders, no winnings, no per-row customer lookup). */
export interface InboxListRow {
  id: string
  enquiry_type: string
  full_name: string
  email: string
  message_preview: string
  giveaway_name: string | null
  order_reference: string | null
  inbox_status: InboxStatus
  inbox_assigned_to: string | null
  inbox_last_message_at: string
  created_at: string
}

/** Keyset cursor for the Inbox list — (inbox_last_message_at, id). */
export interface InboxCursor {
  lastMessageAt: string
  id: string
}

/** Body-length bounds enforced by the DB CHECK constraint (trimmed 1–10000). */
export const REPLY_MIN_LEN = 1
export const REPLY_MAX_LEN = 10000
