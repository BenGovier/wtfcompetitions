import { ContactForm } from "@/components/contact/ContactForm"
import { Mail, Clock, Banknote, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Contact Us | WTF Giveaways",
  description: "Get help with tickets, your account, or winner payouts. Contact the WTF Giveaways team.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8 md:py-12">
        <div className="mx-auto max-w-[640px]">
          {/* Hero Section */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white md:text-4xl">Need help?</h1>
            <p className="mt-3 text-base text-purple-200/80 md:text-lg">
              Whether it&apos;s tickets, your account, or a winner payout, send us the details and we&apos;ll get back to you.
            </p>
          </div>

          {/* Winner Payouts Info Card */}
          <div className="mb-6 rounded-2xl border border-purple-500/30 bg-purple-900/30 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFD700]/20">
                <Banknote className="h-5 w-5 text-[#FFD700]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Winner payouts</h2>
                <p className="mt-1 text-sm text-purple-200/80">
                  We aim to process verified winner payouts within 48 hours, and often sooner. We may need to confirm your identity or ticket/order details before sending payment.
                </p>
              </div>
            </div>
          </div>

          {/* Safety Note */}
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-200/90">
              For your safety, never send passwords, card details, PINs, CVV numbers, or online banking login details.
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-900/20 p-5 md:p-8">
            <ContactForm />
          </div>

          {/* Contact Info Footer */}
          <div className="mt-8 rounded-xl border border-purple-500/20 bg-purple-900/10 p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-purple-300" />
                <span className="text-sm font-medium text-purple-100">ben@wtf-giveaways.co.uk</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
                <div className="text-sm text-purple-200/80">
                  <p>We aim to respond within 24–48 hours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
                <div className="text-sm text-purple-200/80">
                  <p>Verified payouts are aimed for within 48 hours, often sooner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
