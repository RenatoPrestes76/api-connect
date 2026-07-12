import type { AdminRole, Permission } from '@/types';

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  mustChangePassword: boolean;
}

export interface AdminMeResponse {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: Permission[];
  mustChangePassword: boolean;
}

export class AdminAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.split('=')[1];
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('admin_csrf');
  return token ? { 'x-csrf-token': token } : {};
}

async function parseJsonOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AdminAuthError(err?.code ?? 'UNKNOWN_ERROR', err?.message ?? fallbackMessage);
  }
  return data as T;
}

export async function login(req: AdminLoginRequest): Promise<AdminLoginResponse> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    credentials: 'include',
  });
  return parseJsonOrThrow<AdminLoginResponse>(res, 'Falha ao entrar');
}

export async function logout(): Promise<void> {
  await fetch('/api/admin/logout', {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'include',
  }).catch(() => undefined);
}

export async function refresh(): Promise<boolean> {
  const res = await fetch('/api/admin/refresh', { method: 'POST', credentials: 'include' });
  return res.ok;
}

export async function getCurrentUser(): Promise<AdminMeResponse | null> {
  const res = await fetch('/api/admin/me', { credentials: 'include' });
  if (!res.ok) return null;
  return (await res.json()) as AdminMeResponse;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: 'include',
  });
  await parseJsonOrThrow(res, 'Falha ao alterar senha');
}
