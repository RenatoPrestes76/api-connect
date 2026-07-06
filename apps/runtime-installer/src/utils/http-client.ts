import https from 'node:https';
import http from 'node:http';
import type { RequestOptions } from 'node:https';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code:   string,
    message:                string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface JsonResponse<T> {
  data: T;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

export async function postJson<TBody, TResponse>(
  url:  string,
  body: TBody,
): Promise<TResponse> {
  const parsed   = new URL(url);
  const payload  = JSON.stringify(body);
  const isHttps  = parsed.protocol === 'https:';
  const lib      = isHttps ? https : http;

  const options: RequestOptions = {
    hostname: parsed.hostname,
    port:     parsed.port || (isHttps ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent':     `atlas-installer/${process.env['npm_package_version'] ?? '0.1.0'}`,
    },
    // Allow self-signed certs in development
    rejectUnauthorized: process.env['NODE_ENV'] !== 'development',
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          reject(new Error(`Non-JSON response (${res.statusCode}): ${raw.slice(0, 200)}`));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          const err = parsed as ErrorResponse;
          reject(new HttpError(
            res.statusCode,
            err?.error?.code ?? 'UNKNOWN',
            err?.error?.message ?? `HTTP ${res.statusCode}`,
          ));
          return;
        }

        resolve((parsed as JsonResponse<TResponse>).data);
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
