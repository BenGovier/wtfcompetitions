"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Mail } from "lucide-react"

export function FreeEntryInfo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-2 text-xs text-purple-300 underline underline-offset-2 transition-colors hover:text-purple-100"
        >
          Free postal entry available
        </button>
      </DialogTrigger>
      <DialogContent className="border-purple-500/30 bg-[#160a26] text-white sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/50">
            <Mail className="h-6 w-6 text-purple-300" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl text-white">
            Free Postal Entry
          </DialogTitle>
          <DialogDescription className="text-center text-purple-200">
            You can enter this competition by post without making a purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-purple-100">
          <div>
            <h4 className="mb-2 font-semibold text-white">How to enter:</h4>
            <p className="leading-relaxed">
              Send an unenclosed postcard by ordinary first or second class post to:
            </p>
          </div>

          <address className="not-italic rounded-lg border border-purple-500/20 bg-purple-900/30 p-4 text-center leading-relaxed">
            <span className="font-semibold text-amber-400">WTF Giveaways</span>
            <br />
            16 Green Drive
            <br />
            Thornton-Cleveleys
            <br />
            United Kingdom
            <br />
            FY5 1LQ
          </address>

          <div>
            <h4 className="mb-2 font-semibold text-white">
              Include the following details:
            </h4>
            <ul className="list-inside list-disc space-y-1 text-purple-200">
              <li>Your full name</li>
              <li>Postal address</li>
              <li>Phone number</li>
              <li>Email address</li>
              <li>Date of birth</li>
              <li>Competition name</li>
            </ul>
          </div>

          <p className="text-xs text-purple-300">
            Postal entries must be received before the competition closes. One entry per
            postcard. For full details, please{" "}
            <Link
              href="/terms"
              className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
            >
              view full terms
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
