import Link from "next/link"
import Image from "next/image"

export function SiteFooter() {
  return (
    <footer className="pb-20 md:pb-0">
      {/* Gold separator bar */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
      
      {/* Main footer content with purple background */}
      <div className="bg-[#1a0a2e]">
        <div className="container px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Logo section */}
            <div className="lg:col-span-1">
              <Link href="/" className="inline-block">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wtf%20giveaways-44sBKQ2LLlITcFCzv4O7eNndkytyDq.png"
                  alt="WTF Giveaways"
                  width={140}
                  height={140}
                  className="rounded-full"
                />
              </Link>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400">Company</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/about" className="text-white/80 transition-colors hover:text-amber-400">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-white/80 transition-colors hover:text-amber-400">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400">Support</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/faq" className="text-white/80 transition-colors hover:text-amber-400">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/legal/terms" className="text-white/80 transition-colors hover:text-amber-400">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy" className="text-white/80 transition-colors hover:text-amber-400">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/website-terms-of-use" className="text-white/80 transition-colors hover:text-amber-400">
                    Website Terms of Use
                  </Link>
                </li>
                <li>
                  <Link href="/legal/cookies" className="text-white/80 transition-colors hover:text-amber-400">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400">Follow Us</h3>
              <p className="text-sm leading-relaxed text-white/80">Stay updated with our latest giveaways and winners.</p>
              
              <h3 className="mb-4 mt-6 text-xs font-semibold uppercase tracking-wider text-amber-400">Payment Types</h3>
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Untitled%20design%20%2818%29-8FEYI4LGhbATnHZxSbQGUzlEQ01oWe.png"
                alt="We accept Mastercard, Visa, Apple Pay, and Google Pay"
                width={200}
                height={40}
              />
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8 text-center text-sm text-white/60">
            <p>&copy; {new Date().getFullYear()} WTF Giveaways. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
