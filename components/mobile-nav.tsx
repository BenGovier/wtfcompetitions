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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-purple-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
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
                isActive 
                  ? "text-purple-700 font-semibold" 
                  : "text-purple-400 hover:text-purple-600",
              )}
            >
              <div className={cn(
                "flex items-center justify-center rounded-full p-1.5 transition-colors",
                isActive && "bg-purple-100"
              )}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
