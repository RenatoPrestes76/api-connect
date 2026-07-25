interface PortalApiError {
  error: { code: string; message: string };
}

/**
 * Calls the same-origin Next proxy under /api/portal/* (see
 * app/api/portal/**) rather than apps/api directly — that's what forwards
 * the httpOnly portal_session cookie as a Bearer token server-side. Shared
 * by portal.service.ts and gateway.service.ts.
 */
export async function portalFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`/api/portal${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as T | PortalApiError | null;
  if (!res.ok) {
    const message =
      (data as PortalApiError | null)?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
