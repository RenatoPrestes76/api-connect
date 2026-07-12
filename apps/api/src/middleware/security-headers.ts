import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware, RouteContext } from '../http/router.js';

/** Baseline security headers applied to every response. */
export const securityHeaders: Middleware = async (
  _ctx: RouteContext,
  _req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  return next();
};
