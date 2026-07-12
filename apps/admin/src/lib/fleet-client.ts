function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.split('=')[1];
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('admin_csrf');
  return token ? { 'x-csrf-token': token } : {};
}

export class FleetError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/fleet${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new FleetError(err?.code ?? 'UNKNOWN_ERROR', err?.message ?? 'Request failed');
  }
  return data as T;
}

export const fleetGet = <T>(path: string): Promise<T> => request<T>('GET', path);
export const fleetPost = <T>(path: string, payload?: unknown): Promise<T> =>
  request<T>('POST', path, payload ?? {});
export const fleetDelete = <T>(path: string): Promise<T> => request<T>('DELETE', path);
