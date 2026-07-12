import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_API_URL, ACCESS_TOKEN_COOKIE } from '@/lib/admin-api';
import { verifyCsrf } from '@/lib/csrf';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No admin session' } },
      { status: 401 }
    );
  }

  if (MUTATING_METHODS.has(req.method) && !verifyCsrf(req)) {
    return NextResponse.json(
      { error: { code: 'CSRF_MISMATCH', message: 'Invalid CSRF token' } },
      { status: 403 }
    );
  }

  const url = `${ADMIN_API_URL}/admin/control-plane/${path.join('/')}${req.nextUrl.search}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

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
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return proxy(req, (await params).path);
}
