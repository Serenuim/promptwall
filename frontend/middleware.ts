import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/Dashboard', '/admin']
const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cache-Control': 'no-store',
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))

  const res = isProtected
    ? (() => {
        const token = req.cookies.get('pw_token')?.value
        if (!token) {
          const url = req.nextUrl.clone()
          url.pathname = '/auth/signin'
          url.searchParams.set('from', pathname)
          return NextResponse.redirect(url)
        }
        return NextResponse.next()
      })()
    : NextResponse.next()

  Object.entries(SEC_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export const config = { matcher: ['/Dashboard/:path*', '/admin/:path*'] }
