import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PORTAL_API_URL, PORTAL_SESSION_COOKIE } from '@/lib/portal-session';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No portal session' } },
      { status: 401 }
    );
  }

  const upstream = await fetch(`${PORTAL_API_URL}/api/v1/portal/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
