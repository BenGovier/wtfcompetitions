import { ContactForm } from "@/components/contact/ContactForm"
import { Mail, Clock, ShieldAlert } from "lucide-react"

export const metadata = {
  title: "Contact Us | WTF Giveaways",
  description: "Get help with tickets, your account, or winner payouts. Contact the WTF Giveaways team.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container max-w-lg px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white md:text-3xl">Contact WTF Giveaways</h1>
          <p className="mt-2 text-sm text-purple-200/80">
            Need help with tickets, your account, or a winner payout? Send us the details below and we&apos;ll get back to you.
          </p>
        </div>

        {/* Safety Warning */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200/90">
            For your safety, never send passwords, card details, PINs, CVV numbers, or online banking login details.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-purple-500/20 bg-purple-900/20 p-4 md:p-6">
          <ContactForm />
        </div>

        {/* Contact Info Footer */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-purple-200/70">
            <Mail className="h-4 w-4 shrink-0" />
            <span>ben@wtf-giveaways.co.uk</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-purple-200/70">
            <Clock className="h-4 w-4 shrink-0" />
            <span>We aim to respond within 24-48 hours</span>
          </div>
        </div>
      </div>
    </div>
  )
}
