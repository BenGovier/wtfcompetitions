import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function InstantWinsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Instant Wins</h2>
        <p className="text-muted-foreground">
          Configure instant win prizes and probabilities
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>No instant wins configured</CardTitle>
          <CardDescription>
            Set up instant win prizes to reward participants immediately
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/admin/instant-wins">Configure Instant Wins</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
