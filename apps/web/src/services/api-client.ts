import { HUB_API_URL } from '@/lib/constants';

// ─── Error types ──────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = `${HUB_API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hub-Client': 'atlas-hub/1.0',
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'include',
  });

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: { code?: string; message?: string } };
      code = err.error?.code ?? code;
      message = err.error?.message ?? message;
    } catch {
      /* empty */
    }
    throw new ApiClientError(res.status, code, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── HTTP verbs ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>('GET', path, undefined, signal, headers),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>('POST', path, body, signal, headers),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>('PUT', path, body, signal, headers),
  patch: <T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    headers?: Record<string, string>
  ) => request<T>('PATCH', path, body, signal, headers),
  delete: <T>(path: string, signal?: AbortSignal, headers?: Record<string, string>) =>
    request<T>('DELETE', path, undefined, signal, headers),
};
