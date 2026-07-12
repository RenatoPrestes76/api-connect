export const ADMIN_API_URL = process.env['ADMIN_API_URL'] ?? 'http://localhost:3001';

/** Client-visible — the browser connects directly to apps/api's WebSocket server (ticket-authenticated). */
export const ADMIN_API_WS_URL =
  process.env['NEXT_PUBLIC_ADMIN_API_WS_URL'] ?? 'ws://localhost:3001';

export const ACCESS_TOKEN_COOKIE = 'admin_session';
export const REFRESH_TOKEN_COOKIE = 'admin_refresh';

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes, mirrors the backend access-token TTL
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, mirrors the backend refresh-token TTL

export interface AdminApiError {
  error: { code: string; message: string };
}
