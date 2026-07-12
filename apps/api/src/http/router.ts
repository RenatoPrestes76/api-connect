/**
 * Minimal HTTP router — no external deps, Node 20+ built-ins only.
 * Supports path params (:id), method routing, and async middleware chains.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  rawUrl: string;
  pathname: string;
  method: string;
  headers: IncomingMessage['headers'];
  requestId: string;
  /** Set by Supabase auth middleware */
  userId?: string;
  orgId?: string;
  /** Set by agent-auth middleware for Atlas agent routes */
  agentId?: string;
  /** Set by admin-auth middleware for Atlas Control Plane admin routes */
  adminUserId?: string;
  adminEmail?: string;
  adminRole?: string;
  adminPermissions?: string[];
}

export type RouteHandler = (ctx: RouteContext, res: ServerResponse) => Promise<void>;

export type Middleware = (
  ctx: RouteContext,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => Promise<void>;

interface Route {
  method: string;
  pattern: string;
  segments: string[];
  handler: RouteHandler;
}

// ─── Pattern Matching ───────────────────────────────────────────────────────

function matchRoute(route: Route, method: string, pathname: string): Record<string, string> | null {
  if (route.method !== method && route.method !== '*') return null;

  const pathSegments = pathname.split('/').filter(Boolean);
  const routeSegments = route.segments;

  if (routeSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < routeSegments.length; i++) {
    const rs = routeSegments[i];
    const ps = pathSegments[i];
    if (rs && rs.startsWith(':')) {
      params[rs.slice(1)] = decodeURIComponent(ps ?? '');
    } else if (rs !== ps) {
      return null;
    }
  }
  return params;
}

// ─── Body Parser ────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 1024 * 1024; // 1MB

export class PayloadTooLargeError extends Error {}

export async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new PayloadTooLargeError('Request body exceeds maximum allowed size'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}

// ─── Router ────────────────────────────────────────────────────────────────

export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  private add(method: string, pattern: string, handler: RouteHandler): this {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      segments: pattern.split('/').filter(Boolean),
      handler,
    });
    return this;
  }

  get(pattern: string, handler: RouteHandler): this {
    return this.add('GET', pattern, handler);
  }
  post(pattern: string, handler: RouteHandler): this {
    return this.add('POST', pattern, handler);
  }
  put(pattern: string, handler: RouteHandler): this {
    return this.add('PUT', pattern, handler);
  }
  patch(pattern: string, handler: RouteHandler): this {
    return this.add('PATCH', pattern, handler);
  }
  delete(pattern: string, handler: RouteHandler): this {
    return this.add('DELETE', pattern, handler);
  }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl = req.url ?? '/';
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() ?? 'GET';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    let body: unknown;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await parseBody(req);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          json(res, { error: { code: 'PAYLOAD_TOO_LARGE', message: err.message } }, 413);
          return;
        }
        throw err;
      }
    }
    const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();

    let matchedRoute: Route | null = null;
    let params: Record<string, string> = {};

    for (const route of this.routes) {
      const m = matchRoute(route, method, pathname);
      if (m !== null) {
        matchedRoute = route;
        params = m;
        break;
      }
    }

    if (!matchedRoute) {
      json(res, { error: { code: 'NOT_FOUND', message: `${method} ${pathname} not found` } }, 404);
      return;
    }

    const ctx: RouteContext = {
      params,
      query: url.searchParams,
      body,
      rawUrl,
      pathname,
      method,
      headers: req.headers,
      requestId,
    };

    // Run middleware chain
    const chain = [...this.middlewares];
    const handler = matchedRoute.handler;

    const runChain = async (index: number): Promise<void> => {
      if (index < chain.length) {
        const mw = chain[index]!;
        await mw(ctx, req, res, () => runChain(index + 1));
      } else {
        await handler(ctx, res);
      }
    };

    await runChain(0);
  }
}

// ─── Response Helpers ───────────────────────────────────────────────────────

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-ID,X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(),
  });
  res.end(body);
}

export function apiError(
  res: ServerResponse,
  message: string,
  status = 500,
  code = 'INTERNAL_ERROR'
): void {
  json(res, { error: { code, message } }, status);
}

export function paginated<T>(
  res: ServerResponse,
  data: T[],
  total: number,
  page: number,
  pageSize: number
): void {
  json(res, {
    data,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
}
