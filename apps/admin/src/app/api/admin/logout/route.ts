import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_API_URL, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/admin-api';
import { CSRF_COOKIE_NAME, verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCsrf(req)) {
    return NextResponse.json(
      { error: { code: 'CSRF_MISMATCH', message: 'Invalid CSRF token' } },
      { status: 403 }
    );
  }

  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${ADMIN_API_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
  res.cookies.delete(CSRF_COOKIE_NAME);
  return res;
}
