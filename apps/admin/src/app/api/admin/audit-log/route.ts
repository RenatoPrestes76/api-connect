import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_API_URL, ACCESS_TOKEN_COOKIE } from '@/lib/admin-api';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No admin session' } },
      { status: 401 }
    );
  }

  const limit = req.nextUrl.searchParams.get('limit') ?? '50';
  const upstream = await fetch(
    `${ADMIN_API_URL}/admin/audit-log?limit=${encodeURIComponent(limit)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
