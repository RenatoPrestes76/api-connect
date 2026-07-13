import { api } from './api-client';
import type { HubUser, UserRole } from '@/types/index';

export interface CreateUserRequest {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  active?: boolean;
}

export async function listUsers(signal?: AbortSignal): Promise<HubUser[]> {
  return api.get<HubUser[]>('/api/v1/hub/users', signal);
}

export async function createUser(req: CreateUserRequest): Promise<HubUser> {
  return api.post<HubUser>('/api/v1/hub/users', req);
}

export async function updateUser(id: string, req: UpdateUserRequest): Promise<HubUser> {
  return api.put<HubUser>(`/api/v1/hub/users/${id}`, req);
}

export async function deleteUser(id: string): Promise<void> {
  return api.delete(`/api/v1/hub/users/${id}`);
}
