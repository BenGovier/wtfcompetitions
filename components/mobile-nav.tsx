"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Gift, Trophy, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/giveaways", label: "Giveaways", icon: Gift },
  { href: "/winners", label: "Winners", icon: Trophy },
  { href: "/me", label: "Account", icon: User },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#1a1025] shadow-[0_-2px_10px_rgba(0,0,0,0.3)] md:hidden">
      <div className="grid grid-cols-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-white" : "text-white/70 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
