import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed"

export default function LiveFeedPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Feed</h1>
          <p className="text-muted-foreground">
            Live entry activity for the team during campaigns and TikTok lives
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/a/a9/TikTok_logo.svg"
          alt="TikTok"
          className="h-7 opacity-90"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Stream</CardTitle>
          <CardDescription>Real-time entry updates across all campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <LiveActivityFeed />
        </CardContent>
      </Card>
    </div>
  )
}
