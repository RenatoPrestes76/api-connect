import { HUB_API_URL } from './constants';

export const PORTAL_API_URL = HUB_API_URL;

export const PORTAL_SESSION_COOKIE = 'portal_session';

/** Mirrors the backend session-token TTL — see modules/portal-identity/jwt.ts. */
export const PORTAL_SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours

export interface PortalApiError {
  error: { code: string; message: string };
}
