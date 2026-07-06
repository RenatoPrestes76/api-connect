import { randomUUID }            from 'node:crypto';
import type { ServerResponse }   from 'node:http';
import type { RouteContext }     from '../../../http/router.js';
import { json, apiError }        from '../../../http/router.js';
import { hubStore, type HubUser, type UserRole } from './hub-store.js';

export async function hubListUsers(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, [...hubStore.users.values()]);
}

export async function hubCreateUser(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { name?: string; email?: string; role?: UserRole } | undefined;
  if (!body?.name || !body.email || !body.role) {
    apiError(res, 'name, email and role are required', 400, 'VALIDATION_ERROR');
    return;
  }
  const exists = [...hubStore.users.values()].find((u) => u.email === body.email);
  if (exists) { apiError(res, 'Email already in use', 409, 'CONFLICT'); return; }

  const user: HubUser = {
    id:        randomUUID(),
    name:      body.name,
    email:     body.email,
    role:      body.role,
    active:    true,
    createdAt: new Date().toISOString(),
  };
  hubStore.users.set(user.id, user);
  json(res, user, 201);
}

export async function hubUpdateUser(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const user = hubStore.users.get(ctx.params['id']!);
  if (!user) { apiError(res, 'User not found', 404, 'NOT_FOUND'); return; }

  const body = ctx.body as Partial<HubUser> | undefined;
  if (body?.name   !== undefined) user.name   = body.name;
  if (body?.role   !== undefined) user.role   = body.role;
  if (body?.active !== undefined) user.active = body.active;
  json(res, user);
}

export async function hubDeleteUser(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const id = ctx.params['id']!;
  if (!hubStore.users.has(id)) { apiError(res, 'User not found', 404, 'NOT_FOUND'); return; }
  hubStore.users.delete(id);
  res.writeHead(204);
  res.end();
}
