import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_API_URL, ACCESS_TOKEN_COOKIE } from '@/lib/admin-api';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCsrf(req)) {
    return NextResponse.json(
      { error: { code: 'CSRF_MISMATCH', message: 'Invalid CSRF token' } },
      { status: 403 }
    );
  }

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No admin session' } },
      { status: 401 }
    );
  }

  const body: unknown = await req.json().catch(() => null);

  const upstream = await fetch(`${ADMIN_API_URL}/admin/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

  const data: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
