import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GRID_PAGE_SIZE, WINNERS_CUTOFF, WINNERS_KIND, mapWinnerRow } from "@/lib/winners"

export const dynamic = "force-dynamic"

const NO_STORE = {
  headers: { "Cache-Control": "private, no-store" },
}

/**
 * Cursor-paginated winners feed for the "Load more" control.
 *
 * Reads the SAME `winners_feed` source and filters as the initial server load.
 * Pagination is by the `happened_at` timestamp cursor (descending), which is a
 * stable ordering key. One extra row is fetched as a peek to determine
 * `hasMore` without a wasted empty request. Duplicate protection is also
 * enforced on the client via a stable composite key.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")

  // Bounded, non-negotiable page size — never fetch unbounded history.
  const limit = GRID_PAGE_SIZE

  // Validate the cursor is a real timestamp before using it.
  let cursorIso: string | null = null
  if (cursor) {
    const t = Date.parse(cursor)
    if (Number.isNaN(t)) {
      return NextResponse.json({ ok: false, error: "invalid_cursor" }, { status: 400, ...NO_STORE })
    }
    cursorIso = new Date(t).toISOString()
  }

  try {
    const supabase = await createClient()

    let query = supabase
      .from("winners_feed")
      .select("*")
      .eq("kind", WINNERS_KIND)
      .gte("happened_at", WINNERS_CUTOFF)
      .order("happened_at", { ascending: false })
      .limit(limit + 1) // peek one extra to compute hasMore

    if (cursorIso) {
      query = query.lt("happened_at", cursorIso)
    }

    const { data, error } = await query

    if (error) {
      console.error("[api/winners] query error:", error.message)
      return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500, ...NO_STORE })
    }

    const rows = data ?? []
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    const winners = pageRows.map(mapWinnerRow)
    const nextCursor = winners.length > 0 ? winners[winners.length - 1].announcedAt : null

    return NextResponse.json({ ok: true, winners, nextCursor, hasMore }, NO_STORE)
  } catch (err) {
    console.error("[api/winners] unexpected error:", err)
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500, ...NO_STORE })
  }
}
