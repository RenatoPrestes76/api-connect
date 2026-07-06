/**
 * @seltriva/cloud — tests
 * Test infrastructure: factories, builders, fixtures, and assertion helpers.
 */

import type {
  Organization, OrganizationId, Workspace, WorkspaceId,
  Environment, EnvironmentId, Agent, AgentId, User, UserId,
  License, Plugin, FeatureFlag, Configuration, ApiKey,
  OrganizationTier, AgentStatus, MemberRole,
  Slug, Email, SemVer,
} from '../domain/index';

// ─── ID Factories ─────────────────────────────────────────────────────────

export const TestIds = {
  organization: (n?: string): OrganizationId => `org-test-${n ?? '1'}` as OrganizationId,
  workspace:    (n?: string): WorkspaceId    => `ws-test-${n ?? '1'}`  as WorkspaceId,
  environment:  (n?: string): EnvironmentId  => `env-test-${n ?? '1'}` as EnvironmentId,
  agent:        (n?: string): AgentId        => `agt-test-${n ?? '1'}` as AgentId,
  user:         (n?: string): UserId         => `usr-test-${n ?? '1'}` as UserId,
} as const;

// ─── Entity Builders ──────────────────────────────────────────────────────

export function buildOrganization(overrides?: Partial<Organization>): Organization {
  return {
    id:        TestIds.organization(),
    name:      'Test Organization',
    slug:      'test-org' as Slug,
    tier:      'FREE',
    status:    'ACTIVE',
    settings:  {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Organization;
}

export function buildWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    id:             TestIds.workspace(),
    organizationId: TestIds.organization(),
    name:           'Test Workspace',
    slug:           'test-workspace' as Slug,
    createdAt:      new Date('2024-01-01T00:00:00Z'),
    updatedAt:      new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Workspace;
}

export function buildEnvironment(overrides?: Partial<Environment>): Environment {
  return {
    id:          TestIds.environment(),
    workspaceId: TestIds.workspace(),
    name:        'Development',
    slug:        'development' as Slug,
    createdAt:   new Date('2024-01-01T00:00:00Z'),
    updatedAt:   new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Environment;
}

export function buildAgent(overrides?: Partial<Agent>): Agent {
  return {
    id:             TestIds.agent(),
    organizationId: TestIds.organization(),
    environmentId:  TestIds.environment(),
    name:           'test-agent-01',
    status:         'ONLINE' as AgentStatus,
    version:        '0.1.0' as SemVer,
    hostname:       'test-host',
    platform:       'linux',
    arch:           'x64',
    createdAt:      new Date('2024-01-01T00:00:00Z'),
    updatedAt:      new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Agent;
}

export function buildUser(overrides?: Partial<User>): User {
  return {
    id:             TestIds.user(),
    supabaseId:     'supabase-test-1',
    email:          'test@example.com' as Email,
    emailVerified:  true,
    displayName:    'Test User',
    createdAt:      new Date('2024-01-01T00:00:00Z'),
    updatedAt:      new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as User;
}

// ─── Mock Service Builders ────────────────────────────────────────────────

export function buildMockResult<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function buildMockError(code: string, message: string): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code, message } };
}

// ─── Test Fixtures ────────────────────────────────────────────────────────

export const TEST_ORG_ID       = TestIds.organization();
export const TEST_WORKSPACE_ID = TestIds.workspace();
export const TEST_ENV_ID       = TestIds.environment();
export const TEST_AGENT_ID     = TestIds.agent();
export const TEST_USER_ID      = TestIds.user();

export const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
export const TEST_API_KEY_PREFIX = 'sc_test_';
