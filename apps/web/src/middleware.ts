import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { PORTAL_SESSION_COOKIE } from '@/lib/portal-session';

const JWT_SECRET = new TextEncoder().encode(
  process.env['PORTAL_JWT_SECRET'] ?? 'atlas-portal-dev-secret-change-in-prod'
);

/**
 * Scoped to /portal/* only — the rest of the Hub app (ops/security/
 * governance/etc, gated by the separate hub_session system) must be
 * completely unaffected. See the Sprint 46.4 plan for why these two
 * sessions are deliberately kept apart.
 */
const PUBLIC_PORTAL_PATHS = new Set(['/portal/login', '/portal/register', '/portal/accept-invite']);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/') || PUBLIC_PORTAL_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/portal/login', req.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    const res = NextResponse.redirect(new URL('/portal/login', req.url));
    res.cookies.delete(PORTAL_SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*'],
};
