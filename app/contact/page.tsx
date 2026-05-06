import { ContactForm } from "@/components/contact/ContactForm"
import { Mail, Clock, Banknote, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Contact Us | WTF Giveaways",
  description: "Get help with tickets, your account, or winner payouts. Contact the WTF Giveaways team.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-6 md:py-10">
        <div className="mx-auto max-w-lg">
          {/* Hero Section - Compact */}
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-bold text-white md:text-3xl">Need help?</h1>
            <p className="mt-2 text-sm text-purple-200/80">
              Tickets, account, or payout questions? We&apos;ll get back to you.
            </p>
          </div>

          {/* Compact Info Lines */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-900/20 px-3 py-2">
              <Banknote className="h-4 w-4 shrink-0 text-[#FFD700]" />
              <p className="text-xs text-purple-200/80">
                Verified winner payouts aimed for within 48 hours, often sooner.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-200/90">
                Never send passwords, card details, PINs, or CVV numbers.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-900/20 p-4 md:p-6">
            <ContactForm />
          </div>

          {/* Contact Info Footer - Compact */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-purple-200/70">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-purple-300" />
              <span>ben@wtf-giveaways.co.uk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-purple-300" />
              <span>Response within 24–48 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
