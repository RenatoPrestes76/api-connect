import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const CSRF_COOKIE_NAME = 'admin_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  return randomBytes(24).toString('hex');
}

/** Double-submit cookie check: the header value must match the cookie value. */
export function verifyCsrf(req: NextRequest): boolean {
  const cookieValue = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerValue = req.headers.get(CSRF_HEADER_NAME);
  return Boolean(cookieValue) && cookieValue === headerValue;
}
