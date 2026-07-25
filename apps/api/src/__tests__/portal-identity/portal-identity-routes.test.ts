import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  put,
  del,
  seededOwnerAuth,
  type TestServer,
} from './helpers.js';

interface ErrorBody {
  error: { code: string; message: string };
}
interface OrganizationBody {
  id: string;
  name: string;
  razaoSocial: string;
  cnpj: string;
  internalCode: string;
  status: string;
  plan: string;
}
interface AuthResponse {
  token: string;
  organization?: OrganizationBody;
  user: { id: string; email: string; role: string; organizationId: string };
}
interface UsersListResponse {
  total: number;
  users: Array<{ id: string; email: string; role: string }>;
}
interface InviteResponse {
  invite: { id: string; email: string; role: string; expiresAt: string };
  token: string;
}
interface AcceptResponse {
  token: string;
  user: { id: string; email: string; role: string };
}
interface EnvironmentsListResponse {
  total: number;
  environments: Array<{ id: string; name: string; kind: string }>;
}
interface AuditLogResponse {
  total: number;
  entries: Array<{ action: string; actorEmail: string }>;
}

let srv: TestServer;
let ownerAuth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  ownerAuth = await seededOwnerAuth(srv.baseUrl);
});
afterAll(async () => {
  await srv.close();
});

// ─── Auth guard sanity ────────────────────────────────────────────────────────

describe('Portal routes require portal auth', () => {
  it('rejects unauthenticated access to org users', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/users');
    expect(status).toBe(401);
  });

  it('rejects unauthenticated access to environments', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/environments');
    expect(status).toBe(401);
  });

  it('rejects unauthenticated access to the audit log', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/audit-log');
    expect(status).toBe(401);
  });
});

// ─── Register / Login ───────────────────────────────────────────────────────

describe('Organization registration and login', () => {
  it('registers a new organization with an Owner user', async () => {
    const { status, body } = await post<AuthResponse>(srv.baseUrl, '/api/v1/portal/auth/register', {
      name: 'Acme Corp',
      razaoSocial: 'Acme Corporation Ltda',
      cnpj: '00.000.000/0001-00',
      internalCode: 'ORG-ACME',
      owner: { name: 'Acme Owner', email: 'owner@acme.test', password: 'S3nhaForte!' },
    });
    expect(status).toBe(201);
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('OWNER');
  });

  it('logs in with the newly created Owner credentials', async () => {
    const { status, body } = await post<AuthResponse>(srv.baseUrl, '/api/v1/portal/auth/login', {
      email: 'owner@acme.test',
      password: 'S3nhaForte!',
    });
    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
  });

  it('rejects login with a wrong password', async () => {
    const { status, body } = await post<ErrorBody>(srv.baseUrl, '/api/v1/portal/auth/login', {
      email: 'owner@acme.test',
      password: 'wrong',
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

// ─── Invite → accept → role change → remove ────────────────────────────────

describe('Invite lifecycle', () => {
  it('invites, accepts, changes role, and removes a member', async () => {
    const invite = await post<InviteResponse>(
      srv.baseUrl,
      '/api/v1/portal/invites',
      { email: 'teammate@enterprise.demo', name: 'New Teammate', role: 'DEVELOPER' },
      ownerAuth
    );
    expect(invite.status).toBe(201);
    expect(invite.body.token).toBeTruthy();

    const accept = await post<AcceptResponse>(
      srv.baseUrl,
      `/api/v1/portal/invites/${invite.body.token}/accept`,
      { password: 'NovaSenha123!' }
    );
    expect(accept.status).toBe(201);
    expect(accept.body.user.role).toBe('DEVELOPER');
    const newUserId = accept.body.user.id;

    const listed = await get<UsersListResponse>(srv.baseUrl, '/api/v1/portal/users', ownerAuth);
    expect(listed.body.users.some((u) => u.id === newUserId)).toBe(true);

    const roleChange = await put<{ id: string; role: string }>(
      srv.baseUrl,
      `/api/v1/portal/users/${newUserId}/role`,
      { role: 'OPERATOR' },
      ownerAuth
    );
    expect(roleChange.status).toBe(200);
    expect(roleChange.body.role).toBe('OPERATOR');

    const removed = await del(srv.baseUrl, `/api/v1/portal/users/${newUserId}`, ownerAuth);
    expect(removed.status).toBe(200);
  });

  it('rejects accepting an already-accepted invite twice', async () => {
    const invite = await post<InviteResponse>(
      srv.baseUrl,
      '/api/v1/portal/invites',
      { email: 'reuse@enterprise.demo', name: 'Reuse Test', role: 'VIEWER' },
      ownerAuth
    );
    const first = await post<AcceptResponse>(
      srv.baseUrl,
      `/api/v1/portal/invites/${invite.body.token}/accept`,
      { password: 'OutraSenha123!' }
    );
    expect(first.status).toBe(201);

    const second = await post<ErrorBody>(
      srv.baseUrl,
      `/api/v1/portal/invites/${invite.body.token}/accept`,
      { password: 'OutraSenha123!' }
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVITE_ALREADY_ACCEPTED');
  });

  it('rejects accepting an unknown token', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/api/v1/portal/invites/not-a-real-token/accept',
      { password: 'AnyPassword123!' }
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('INVITE_NOT_FOUND');
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('denies a Viewer from inviting new members', async () => {
    const invite = await post<InviteResponse>(
      srv.baseUrl,
      '/api/v1/portal/invites',
      { email: 'viewer-rbac@enterprise.demo', name: 'Viewer RBAC', role: 'VIEWER' },
      ownerAuth
    );
    const accept = await post<AcceptResponse>(
      srv.baseUrl,
      `/api/v1/portal/invites/${invite.body.token}/accept`,
      { password: 'ViewerSenha123!' }
    );
    const viewerAuth = { Authorization: `Bearer ${accept.body.token}` };

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/api/v1/portal/invites',
      { email: 'blocked@enterprise.demo', name: 'Blocked', role: 'VIEWER' },
      viewerAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Environments ───────────────────────────────────────────────────────────

describe('Environments', () => {
  it('seeds 3 default environments for the demo organization', async () => {
    const { status, body } = await get<EnvironmentsListResponse>(
      srv.baseUrl,
      '/api/v1/portal/environments',
      ownerAuth
    );
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.environments.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['production', 'staging', 'development'])
    );
  });

  it('creates and deletes a custom environment', async () => {
    const created = await post<{ id: string; name: string }>(
      srv.baseUrl,
      '/api/v1/portal/environments',
      { name: 'Sandbox', kind: 'development' },
      ownerAuth
    );
    expect(created.status).toBe(201);

    const deleted = await del(
      srv.baseUrl,
      `/api/v1/portal/environments/${created.body.id}`,
      ownerAuth
    );
    expect(deleted.status).toBe(200);
  });
});

// ─── Audit log ──────────────────────────────────────────────────────────────

describe('Audit log', () => {
  it('records organization actions', async () => {
    const { status, body } = await get<AuditLogResponse>(
      srv.baseUrl,
      '/api/v1/portal/audit-log',
      ownerAuth
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.entries.some((e) => e.action === 'USER_INVITED')).toBe(true);
  });
});
