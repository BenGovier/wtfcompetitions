import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function EntriesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Entries</h2>
        <p className="text-muted-foreground">
          View and manage participant entries
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>No entries yet</CardTitle>
          <CardDescription>
            Entries will appear here once campaigns are live
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/admin/entries">View Entries</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
