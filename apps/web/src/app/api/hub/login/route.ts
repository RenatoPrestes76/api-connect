import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env['HUB_JWT_SECRET'] ?? 'atlas-hub-dev-secret-change-in-prod'
);

// Demo credential store — replace with real user DB lookup
const DEMO_USERS: Record<string, { password: string; role: string; name: string }> = {
  'admin@example.com': { password: 'admin123', role: 'SUPER_ADMIN', name: 'Super Admin' },
  'ops@example.com': { password: 'ops123', role: 'OPERATOR', name: 'Operator' },
  'viewer@example.com': { password: 'viewer123', role: 'READ_ONLY', name: 'Read Only' },
};

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid request body' } },
      { status: 400 }
    );
  }

  const { email = '', password = '' } = body;
  const user = DEMO_USERS[email.toLowerCase()];

  if (!user || user.password !== password) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 8; // 8 hours

  const token = await new SignJWT({
    sub: email,
    role: user.role,
    name: user.name,
    email: email,
    iat: now,
    exp: exp,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);

  const response = NextResponse.json({
    user: { sub: email, role: user.role, name: user.name, email, iat: now, exp },
    token,
  });

  response.cookies.set('hub_session', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  });

  return response;
}
