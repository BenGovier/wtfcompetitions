"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet"

export function MobileAuthMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="sm:hidden p-2 text-slate-900 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[280px] bg-[#0a0118] border-purple-900/50 text-white"
      >
        <SheetHeader className="border-b border-purple-900/30 pb-4">
          <SheetTitle className="text-white text-lg">Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 py-4">
          <SheetClose asChild>
            <Link
              href="/"
              className="flex items-center px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              Home
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/giveaways"
              className="flex items-center px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              Giveaways
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/winners"
              className="flex items-center px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              Winners
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/about"
              className="flex items-center px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              About
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/contact"
              className="flex items-center px-4 py-3 text-sm font-medium text-purple-100 hover:bg-purple-900/30 rounded-lg transition-colors"
            >
              Contact
            </Link>
          </SheetClose>
        </nav>

        <SheetFooter className="border-t border-purple-900/30 pt-4 flex-col gap-3">
          <SheetClose asChild>
            <Button
              asChild
              className="w-full bg-red-600 text-white hover:bg-red-700 font-semibold"
            >
              <Link href="/auth/sign-up">Create account</Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="outline"
              asChild
              className="w-full border-purple-700 bg-transparent text-white hover:bg-purple-900/30"
            >
              <Link href="/auth/login">Log in</Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
