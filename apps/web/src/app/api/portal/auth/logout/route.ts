import { NextResponse } from 'next/server';
import { PORTAL_SESSION_COOKIE } from '@/lib/portal-session';

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(PORTAL_SESSION_COOKIE);
  return res;
}
