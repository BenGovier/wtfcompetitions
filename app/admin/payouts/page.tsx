import { createClient } from "@supabase/supabase-js"

export default async function AdminPayoutsPage() {
  // Use service role client to bypass RLS - server-side only, never exposed to browser
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Query winner_payout enquiries directly - no polling, no realtime
  const { data: payouts, error } = await supabase
    .from("contact_enquiries")
    .select(`
      id,
      created_at,
      first_name,
      last_name,
      full_name,
      tiktok_username,
      order_reference,
      phone,
      email,
      amount_claimed_pence,
      verified_amount_pence,
      preferred_payout_method,
      payout_account_holder_name,
      payout_sort_code,
      payout_account_number,
      payout_paypal_email,
      payout_contact_detail,
      status,
      message,
      payout_admin_notes
    `)
    .eq("enquiry_type", "winner_payout")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Failed to fetch payouts:", error)
  }

  function formatPence(pence: number | null): string {
    if (pence == null) return "—"
    return `£${(pence / 100).toFixed(2)}`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getDisplayName(row: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  }): string {
    if (row.first_name && row.last_name) {
      return `${row.first_name} ${row.last_name}`
    }
    return row.full_name || "—"
  }

  function getTikTokUsername(row: {
    tiktok_username?: string | null
    order_reference?: string | null
  }): string {
    return row.tiktok_username || row.order_reference || "—"
  }

  function getStatusBadgeClass(status: string | null): string {
    switch (status) {
      case "new":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "paid":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "problem":
        return "bg-red-500/20 text-red-300 border-red-500/30"
      case "in_progress":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Winner Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Contact form submissions for winner payouts. Most recent first.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          Failed to load payouts. Please refresh the page.
        </div>
      )}

      {!error && (!payouts || payouts.length === 0) && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No winner payout submissions yet.
        </div>
      )}

      {payouts && payouts.length > 0 && (
        <div className="space-y-4">
          {payouts.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{getDisplayName(row)}</span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(row.status)}`}
                    >
                      {row.status || "unknown"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Claimed: </span>
                    <span className="font-medium text-yellow-400">
                      {formatPence(row.amount_claimed_pence)}
                    </span>
                  </div>
                  {row.verified_amount_pence != null && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Verified: </span>
                      <span className="font-medium text-green-400">
                        {formatPence(row.verified_amount_pence)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact details */}
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">TikTok: </span>
                  <span className="font-medium">{getTikTokUsername(row)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span>{row.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span>{row.email || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Method: </span>
                  <span className="capitalize">
                    {row.preferred_payout_method?.replace("_", " ") || "—"}
                  </span>
                </div>
              </div>

              {/* Bank details - only show for bank_transfer */}
              {row.preferred_payout_method === "bank_transfer" && (
                <div className="rounded border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Bank Details
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Account Holder: </span>
                      <span>{row.payout_account_holder_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sort Code: </span>
                      <span className="font-mono">{row.payout_sort_code || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account No: </span>
                      <span className="font-mono">{row.payout_account_number || "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PayPal details */}
              {row.preferred_payout_method === "paypal" && row.payout_paypal_email && (
                <div className="rounded border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    PayPal Details
                  </div>
                  <div>
                    <span className="text-muted-foreground">PayPal Email: </span>
                    <span>{row.payout_paypal_email}</span>
                  </div>
                </div>
              )}

              {/* Other payout method */}
              {row.preferred_payout_method === "other" && row.payout_contact_detail && (
                <div className="rounded border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Other Payout Method
                  </div>
                  <div>{row.payout_contact_detail}</div>
                </div>
              )}

              {/* Message */}
              {row.message && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Message: </span>
                  <span className="whitespace-pre-wrap">{row.message}</span>
                </div>
              )}

              {/* Admin notes */}
              {row.payout_admin_notes && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-sm">
                  <span className="text-amber-400">Admin Notes: </span>
                  <span className="whitespace-pre-wrap">{row.payout_admin_notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
