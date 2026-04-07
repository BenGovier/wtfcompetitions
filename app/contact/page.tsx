import { SectionHeader } from "@/components/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, Clock, Zap } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Contact Us" subtitle="Have questions? We're here to help" />

      <div className="mt-8 space-y-8">
        {/* Email Support Section */}
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950 to-purple-900">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-500">
                <Mail className="size-6 text-white" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-white">Email Support</h2>
                <a
                  href="mailto:ben@wtf-giveaways.co.uk"
                  className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-xl font-bold text-white transition-transform hover:scale-105 hover:from-purple-500 hover:to-pink-500"
                >
                  ben@wtf-giveaways.co.uk
                </a>
                <p className="text-sm text-white/90">
                  For instant win payouts, please include your full name, sort code and account number.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Section */}
        <Card className="border-gray-200 bg-white shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Clock className="size-6 text-amber-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">Response Time</h2>
                <p className="text-gray-700">
                  We aim to respond and process payments within 24-48 hours.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fastest Way Section */}
        <Card className="border-gray-200 bg-white shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink-100">
                <Zap className="size-6 text-pink-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">Fastest Way to Get Paid</h2>
                <p className="text-gray-700">
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
