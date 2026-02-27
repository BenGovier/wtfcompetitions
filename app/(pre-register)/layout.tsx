import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "../globals.css"

const _geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WIN The Ultimate Kit - WTF Giveaways LIVE",
  description:
    "Choleigh is LIVE — join the free VIP drop list and win the £59.99 What The Collection Ultimate Kit.",
}

export default function PreRegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
