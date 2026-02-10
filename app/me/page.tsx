import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function AccountPage() {
  return (
    <div className="container px-4 py-8">
      <SectionHeader title="My Account" subtitle="Manage your entries and profile" />

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">Authentication not yet implemented</p>
          <div className="flex gap-2">
            <Button>Sign In</Button>
            <Button variant="outline">Create Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
