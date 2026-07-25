import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PORTAL_API_URL, PORTAL_SESSION_COOKIE } from '@/lib/portal-session';

/**
 * Catch-all proxy for the session-authenticated portal-identity surface
 * (organization, environments, users, invites, audit-log). The invite-accept
 * and auth (register/login/logout/me) endpoints have their own dedicated
 * route handlers instead — they need to set/clear the session cookie rather
 * than just forward it. No CSRF protection yet (unlike apps/admin's
 * proxy) — deliberately out of scope for this sprint, flagged for follow-up.
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;

  const url = `${PORTAL_API_URL}/api/v1/portal/${path.join('/')}${req.nextUrl.search}`;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const init: RequestInit = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    headers['Content-Type'] = 'application/json';
    init.body = await req.text();
  }

  const upstream = await fetch(url, init);
  const data: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
