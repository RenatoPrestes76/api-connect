function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.split('=')[1];
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('admin_csrf');
  return token ? { 'x-csrf-token': token } : {};
}

export class ControlPlaneError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/control-plane${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ControlPlaneError(err?.code ?? 'UNKNOWN_ERROR', err?.message ?? 'Request failed');
  }
  return data as T;
}

export const cpGet = <T>(path: string): Promise<T> => request<T>('GET', path);
export const cpPost = <T>(path: string, payload?: unknown): Promise<T> =>
  request<T>('POST', path, payload ?? {});
export const cpPatch = <T>(path: string, payload?: unknown): Promise<T> =>
  request<T>('PATCH', path, payload ?? {});
export const cpDelete = <T>(path: string): Promise<T> => request<T>('DELETE', path);
