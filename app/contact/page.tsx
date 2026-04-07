import { SectionHeader } from "@/components/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, Clock, Zap } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Contact Us" subtitle="Have questions? We're here to help" />

      <div className="mt-8 space-y-6">
        {/* Email Support Section */}
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-purple-900/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                <Mail className="size-6 text-purple-400" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-white">Email Support</h2>
                <a
                  href="mailto:ben@wtf-giveaways.co.uk"
                  className="inline-block rounded-lg bg-purple-600 px-5 py-3 text-lg font-bold text-white transition-colors hover:bg-purple-500"
                >
                  ben@wtf-giveaways.co.uk
                </a>
                <p className="text-sm text-purple-200/80">
                  For instant win payouts, please include your full name, sort code and account number.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Section */}
        <Card className="border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <Clock className="size-6 text-amber-400" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white">Response Time</h2>
                <p className="text-purple-200/80">
                  We aim to respond and process payments within 24-48 hours.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fastest Way Section */}
        <Card className="border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink-500/20">
                <Zap className="size-6 text-pink-400" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white">Fastest Way to Get Paid</h2>
                <p className="text-purple-200/80">
                  If you&apos;ve won during a live, sending your details by email is the quickest way to receive your payment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
