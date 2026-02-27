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

const siteDescription =
  "Win insane prizes with WTF Giveaways. Enter giveaways, instant wins, and see real winners."

export const metadata: Metadata = {
  metadataBase: new URL("https://wtf-giveaways.co.uk"),
  title: {
    default: "WTF Giveaways",
    template: "%s | WTF Giveaways",
  },
  description: siteDescription,
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
  openGraph: {
    type: "website",
    siteName: "WTF Giveaways",
    url: "https://wtf-giveaways.co.uk",
    title: "WTF Giveaways",
    description: siteDescription,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "WTF Giveaways",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WTF Giveaways",
    description: siteDescription,
    images: ["/og.jpg"],
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
