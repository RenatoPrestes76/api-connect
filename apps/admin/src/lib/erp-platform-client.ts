// Shared client for the 4 new Sprint 46.15 proxies (atlas-runtimes,
// erp-metadata, semantic-mapping, canonical-model) — same request/CSRF
// shape as control-plane-client.ts, parameterized by proxy prefix instead
// of hardcoding a single one.

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.split('=')[1];
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('admin_csrf');
  return token ? { 'x-csrf-token': token } : {};
}

export class ErpPlatformError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(
  prefix: string,
  method: string,
  path: string,
  payload?: unknown
): Promise<T> {
  const res = await fetch(`/api/admin/${prefix}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ErpPlatformError(err?.code ?? 'UNKNOWN_ERROR', err?.message ?? 'Request failed');
  }
  return data as T;
}

export function makeErpPlatformClient(prefix: string): {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, payload?: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
} {
  return {
    get: <T>(path: string) => request<T>(prefix, 'GET', path),
    post: <T>(path: string, payload?: unknown) => request<T>(prefix, 'POST', path, payload ?? {}),
    del: <T>(path: string) => request<T>(prefix, 'DELETE', path),
  };
}
