import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin/auth"

export default async function BalloonBoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin({ roles: ["admin"] })

  const { id } = await params

  // Lightweight lookup (this page only loads when explicitly opened).
  const supabase = await createClient()
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, presentation_type")
    .eq("id", id)
    .maybeSingle()

  if (!campaign) {
    notFound()
  }

  const title = campaign.title ?? "Campaign"
  const isBalloonPop = campaign.presentation_type === "balloon_pop"

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Campaigns
        </Link>

        {isBalloonPop ? (
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
            <p className="text-muted-foreground">Balloon Board</p>
          </div>
        ) : null}
      </div>

      {isBalloonPop ? (
        <>
          <p className="text-muted-foreground">
            Manage physical balloon selections and revealed prizes during the live.
          </p>
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Balloon Board setup will be added in the next phase.
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This campaign is not configured as a Balloon Pop competition.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
