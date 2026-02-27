import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { headers } from "next/headers"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { MobileNav } from "@/components/mobile-nav"
import { SiteFooter } from "@/components/site-footer"
import { AnnouncementBar } from "@/components/announcement-bar"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WTF Giveaways - Win Amazing Prizes",
  description:
    "Enter giveaways for a chance to win tech, gaming gear, and more. Verified winners, secure payments, instant entry.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const hdrs = await headers()
  const pathname = hdrs.get("x-next-pathname") ?? hdrs.get("x-invoke-path") ?? ""
  const isBarePage = pathname.startsWith("/pre-register")

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {!isBarePage && <AnnouncementBar />}
        {!isBarePage && <SiteHeader />}
        <main className={isBarePage ? "" : "min-h-[calc(100vh-4rem)]"}>{children}</main>
        {!isBarePage && <SiteFooter />}
        {!isBarePage && <MobileNav />}
        <Analytics />
      </body>
    </html>
  )
}
