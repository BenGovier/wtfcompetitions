import { ContactForm } from "@/components/contact/ContactForm"
import { Clock } from "lucide-react"

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

          {/* Form Card */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-900/20 p-4 md:p-6">
            <ContactForm />
          </div>

          {/* Contact Info Footer - Compact */}
          <div className="mt-4 flex flex-col items-center gap-2 text-xs text-purple-200/70">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-purple-300" />
              <span>Response within 24-48 hours</span>
            </div>
            <p className="text-center text-purple-200/60">
              All winnings are paid Monday - Friday 9am - 5pm, please allow 48 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
