"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Gift, Trophy, User, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

// 5 items: Home, Winners on left | Giveaways center | Account, Contact on right
const leftItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/winners", label: "Winners", icon: Trophy },
]

const centerItem = { href: "/giveaways", label: "Giveaways", icon: Gift }

const rightItems = [
  { href: "/me", label: "Account", icon: User },
  { href: "/contact", label: "Contact", icon: Mail },
]

export function MobileNav() {
  const pathname = usePathname()

  const renderNavItem = (item: typeof leftItems[0], isCenter = false) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    const Icon = item.icon

    if (isCenter) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className="relative -mt-6 flex flex-col items-center"
        >
          {/* Elevated center button */}
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-200",
              "bg-gradient-to-b from-[#FFD46A] to-[#F7A600]",
              "border-4 border-purple-950",
              "hover:scale-105 hover:shadow-[0_0_20px_rgba(247,166,0,0.5)]",
              isActive && "shadow-[0_0_25px_rgba(247,166,0,0.6)] scale-105"
            )}
          >
            <Icon className="h-7 w-7 text-purple-950" aria-hidden="true" />
          </div>
          <span className={cn(
            "mt-1 text-[10px] font-bold uppercase tracking-wide",
            isActive ? "text-amber-400" : "text-white/90"
          )}>
            {item.label}
          </span>
        </Link>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex flex-col items-center gap-0.5 py-2 transition-colors",
          isActive ? "text-amber-400" : "text-white/70 hover:text-white"
        )}
      >
        <div className={cn(
          "flex items-center justify-center rounded-lg p-1.5 transition-all",
          isActive && "bg-white/10"
        )}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className={cn(
          "text-[10px] font-medium",
          isActive && "font-semibold"
        )}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the nav */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Curved notch background using SVG */}
        <div className="relative">
          {/* SVG curved background */}
          <svg
            className="absolute bottom-0 left-0 right-0 h-20 w-full"
            viewBox="0 0 400 80"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 20 L160 20 Q175 20 180 35 Q200 70 220 35 Q225 20 240 20 L400 20 L400 80 L0 80 Z"
              className="fill-purple-950"
            />
            {/* Subtle top border/glow line */}
            <path
              d="M0 20 L160 20 Q175 20 180 35 Q200 70 220 35 Q225 20 240 20 L400 20"
              className="stroke-purple-700/50"
              strokeWidth="1"
              fill="none"
            />
          </svg>

          {/* Nav content */}
          <div className="relative z-10 flex items-end justify-between px-4 pb-4 pt-2">
            {/* Left items */}
            <div className="flex flex-1 justify-around">
              {leftItems.map((item) => renderNavItem(item))}
            </div>

            {/* Center item (elevated) */}
            <div className="flex-shrink-0 px-2">
              {renderNavItem(centerItem, true)}
            </div>

            {/* Right items */}
            <div className="flex flex-1 justify-around">
              {rightItems.map((item) => renderNavItem(item))}
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
