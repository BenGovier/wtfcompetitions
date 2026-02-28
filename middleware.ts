import { updateSession } from '@/lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

/* ------------------------------------------------------------------ */
/*  Maintenance-mode allow-list                                       */
/* ------------------------------------------------------------------ */
const MAINTENANCE_ALLOWED_PATHS = new Set([
  '/pre-register',
  '/api/pre-register',
  '/legal/terms',
  '/legal/privacy',
])

const MAINTENANCE_ALLOWED_PREFIXES = ['/_next/']

const MAINTENANCE_ALLOWED_ASSETS = new Set([
  '/og.jpg',
  '/favicon.ico',
  '/icon.svg',
  '/icon-dark-32x32.png',
  '/icon-light-32x32.png',
  '/apple-icon.png',
  '/robots.txt',
  '/sitemap.xml',
])

function isMaintenanceAllowed(pathname: string): boolean {
  if (MAINTENANCE_ALLOWED_PATHS.has(pathname)) return true
  if (MAINTENANCE_ALLOWED_ASSETS.has(pathname)) return true
  if (pathname.startsWith('/images/')) return true
  for (const prefix of MAINTENANCE_ALLOWED_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  /* ---- Maintenance-mode gate ---- */
  if (maintenanceMode) {
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN ?? ''

    // Handle ?bypass=<token> — set cookie and strip the param
    const bypassParam = searchParams.get('bypass')
    if (bypassParam && bypassToken && bypassParam === bypassToken) {
      const cleanUrl = request.nextUrl.clone()
      cleanUrl.searchParams.delete('bypass')
      const res = NextResponse.redirect(cleanUrl)
      res.cookies.set('maintenance_bypass', bypassToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
      return res
    }

    // Check bypass cookie
    const bypassCookie = request.cookies.get('maintenance_bypass')?.value
    const hasBypass = bypassToken && bypassCookie === bypassToken

    // If no bypass and path is not in the allow-list, redirect to /pre-register
    if (!hasBypass && !isMaintenanceAllowed(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/pre-register'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl, 307)
    }
  }

  /* ---- Existing behaviour (unchanged) ---- */

  // Intercept email confirmation codes landing on / and route to auth callback
  if (pathname === '/' && searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.search = request.nextUrl.search
    return NextResponse.redirect(callbackUrl)
  }

  const response = await updateSession(request)
  response.headers.set('x-next-pathname', pathname)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
