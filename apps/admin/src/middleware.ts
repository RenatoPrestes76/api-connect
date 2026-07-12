import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env['ADMIN_JWT_SECRET'] ?? 'atlas-admin-dev-secret-change-in-prod'
);
const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'admin_session';

/** Routes that are accessible without an authenticated admin session. */
const PUBLIC_PATHS = new Set([LOGIN_PATH, '/api/admin/login', '/api/admin/logout']);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // API routes enforce their own auth and return JSON 401s — redirecting them
  // to the (HTML) login page here would break every fetch() call on 401/expiry.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    const res = NextResponse.redirect(new URL(LOGIN_PATH, req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
