import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  PORTAL_API_URL,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE,
} from '@/lib/portal-session';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body: unknown = await req.json().catch(() => null);

  const upstream = await fetch(`${PORTAL_API_URL}/api/v1/portal/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const { token, organization, user } = data as {
    token: string;
    organization: unknown;
    user: unknown;
  };

  const res = NextResponse.json({ organization, user }, { status: 201 });
  res.cookies.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_SESSION_MAX_AGE,
  });
  return res;
}
