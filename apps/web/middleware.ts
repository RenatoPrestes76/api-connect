import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env['HUB_JWT_SECRET'] ?? 'atlas-hub-dev-secret-change-in-prod'
);
const LOGIN_PATH = '/login';

/** Routes that are accessible without authentication. */
const PUBLIC_PATHS = new Set([LOGIN_PATH, '/api/hub/login', '/api/hub/logout']);

/** Minimum role required per route prefix. */
const ROUTE_ROLES: Array<[string, string[]]> = [
  ['/settings', ['SUPER_ADMIN', 'ADMIN']],
  ['/users', ['SUPER_ADMIN', 'ADMIN']],
  ['/connectors', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR']],
  ['/sync', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR']],
  ['/discovery', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR']],
  ['/agents', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY']],
  ['/databases', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY']],
  ['/health', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY']],
  ['/logs', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY']],
  ['/dashboard', ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY']],
];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Validate session cookie
  const token = req.cookies.get('hub_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  let role: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    role = (payload['role'] as string | undefined) ?? '';
  } catch {
    const res = NextResponse.redirect(new URL(LOGIN_PATH, req.url));
    res.cookies.delete('hub_session');
    return res;
  }

  // Check route permission
  for (const [prefix, allowed] of ROUTE_ROLES) {
    if (pathname.startsWith(prefix)) {
      if (!allowed.includes(role)) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      break;
    }
  }

  // Inject role as header for Server Components
  const response = NextResponse.next();
  response.headers.set('x-hub-role', role);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
