import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Contact Us" subtitle="Have questions? We're here to help" />

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <Mail className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-lg font-medium">Get in Touch</p>
            <p className="mt-1 text-sm text-muted-foreground">Contact form functionality will be added soon</p>
          </div>
          <Button disabled>Send Message</Button>
        </CardContent>
      </Card>
    </div>
  )
}
