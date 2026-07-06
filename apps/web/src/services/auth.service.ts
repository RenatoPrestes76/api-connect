import type { SessionPayload } from '@/types/index';

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface LoginResponse {
  user:  SessionPayload;
  token: string;
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await fetch('/api/hub/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? 'Invalid credentials');
  }
  return res.json() as Promise<LoginResponse>;
}

export async function logout(): Promise<void> {
  await fetch('/api/hub/logout', { method: 'POST', credentials: 'include' });
}
