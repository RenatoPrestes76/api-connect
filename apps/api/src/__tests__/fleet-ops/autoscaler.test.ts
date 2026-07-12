import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  patch,
  del,
  superAdminAuth,
  type TestServer,
} from './helpers.js';

let srv: TestServer;
let auth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);
});
afterAll(async () => {
  await srv.close();
});

const G = (path: string) => get(srv.baseUrl, path, auth);
const P = (path: string, data?: unknown) => post(srv.baseUrl, path, data, auth);
const PA = (path: string, data?: unknown) => patch(srv.baseUrl, path, data, auth);
const D = (path: string) => del(srv.baseUrl, path, auth);

async function onlineRuntime(): Promise<{
  id: string;
  organizationId: string;
  environmentId: string;
}> {
  const { body } = await G('/admin/control-plane/runtimes?status=ONLINE');
  return (body as any).runtimes[0];
}

async function heartbeat(runtimeId: string, cpuPct: number, memPct: number): Promise<void> {
  await P('/admin/fleet/runtime/heartbeat', {
    runtimeId,
    cpuPct,
    memPct,
    diskPct: 20,
    latencyMs: 5,
  });
}

describe('Autoscale policies (CRUD)', () => {
  it('creates, reads, updates, and deletes a policy', async () => {
    const runtime = await onlineRuntime();

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 3,
      targetCpuPct: 80,
      targetMemPct: 80,
    });
    expect(create.status).toBe(201);
    const policyId = (create.body as any).id;

    const read = await G(`/admin/fleet/autoscaler/policies/${policyId}`);
    expect(read.status).toBe(200);
    expect((read.body as any).minInstances).toBe(1);

    const update = await PA(`/admin/fleet/autoscaler/policies/${policyId}`, { maxInstances: 5 });
    expect(update.status).toBe(200);
    expect((update.body as any).maxInstances).toBe(5);

    const del = await D(`/admin/fleet/autoscaler/policies/${policyId}`);
    expect(del.status).toBe(200);

    const gone = await G(`/admin/fleet/autoscaler/policies/${policyId}`);
    expect(gone.status).toBe(404);
  });

  it('rejects maxInstances < minInstances', async () => {
    const runtime = await onlineRuntime();
    const { status, body } = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 5,
      maxInstances: 2,
      targetCpuPct: 80,
      targetMemPct: 80,
    });
    expect(status).toBe(400);
    expect((body as any).error.code).toBe('INVALID_RANGE');
  });
});

describe('Autoscaler — real scale-up on high CPU', () => {
  it('provisions a new runtime when average pool CPU exceeds target', async () => {
    const runtime = await onlineRuntime();
    await heartbeat(runtime.id, 95, 40); // push CPU well above target

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 10,
      targetCpuPct: 80,
      targetMemPct: 80,
      cooldownMs: 0,
    });
    const policyId = (create.body as any).id;

    const before = await G(
      `/admin/control-plane/runtimes?organizationId=${runtime.organizationId}&environmentId=${runtime.environmentId}&status=ONLINE`
    );
    const countBefore = (before.body as any).runtimes.length;

    const evaluate = await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    expect(evaluate.status).toBe(200);
    expect((evaluate.body as any).action).toBe('SCALE_UP');
    expect((evaluate.body as any).instancesAfter).toBe(countBefore + 1);

    const after = await G(
      `/admin/control-plane/runtimes?organizationId=${runtime.organizationId}&environmentId=${runtime.environmentId}&status=ONLINE`
    );
    expect((after.body as any).runtimes.length).toBe(countBefore + 1);
    expect(
      (after.body as any).runtimes.some((r: any) => r.name.startsWith('autoscaled-worker-'))
    ).toBe(true);
  });

  it('does not exceed maxInstances', async () => {
    const runtime = await onlineRuntime();
    await heartbeat(runtime.id, 99, 99);

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 1, // pool is already at (or above) this
      targetCpuPct: 50,
      targetMemPct: 50,
      cooldownMs: 0,
    });
    const policyId = (create.body as any).id;

    const evaluate = await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    expect((evaluate.body as any).action).toBe('NO_ACTION');
    expect((evaluate.body as any).reason).toContain('maxInstances');
  });

  it('respects cooldown between scaling actions', async () => {
    const runtime = await onlineRuntime();
    await heartbeat(runtime.id, 95, 95);

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 20,
      targetCpuPct: 80,
      targetMemPct: 80,
      cooldownMs: 60_000,
    });
    const policyId = (create.body as any).id;

    const first = await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    expect((first.body as any).action).toBe('SCALE_UP');

    const second = await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    expect((second.body as any).action).toBe('NO_ACTION');
    expect((second.body as any).reason).toContain('cooldown');
  });
});

describe('Autoscaler — scale-down on low utilization', () => {
  it('retires a runtime when the pool is well under half of target', async () => {
    const runtime = await onlineRuntime();
    await heartbeat(runtime.id, 5, 5);

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 0,
      maxInstances: 10,
      targetCpuPct: 80,
      targetMemPct: 80,
      cooldownMs: 0,
    });
    const policyId = (create.body as any).id;

    const before = await G(
      `/admin/control-plane/runtimes?organizationId=${runtime.organizationId}&environmentId=${runtime.environmentId}&status=ONLINE`
    );
    const countBefore = (before.body as any).runtimes.length;

    const evaluate = await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    expect((evaluate.body as any).action).toBe('SCALE_DOWN');
    expect((evaluate.body as any).instancesAfter).toBe(countBefore - 1);
  });
});

describe('GET /admin/fleet/autoscaler/events', () => {
  it('records SCALE_UP/SCALE_DOWN events but not NO_ACTION', async () => {
    const runtime = await onlineRuntime();
    await heartbeat(runtime.id, 95, 40);

    const create = await P('/admin/fleet/autoscaler/policies', {
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 10,
      targetCpuPct: 80,
      targetMemPct: 80,
      cooldownMs: 0,
    });
    const policyId = (create.body as any).id;

    await P(`/admin/fleet/autoscaler/policies/${policyId}/evaluate`);
    const { status, body } = await G(`/admin/fleet/autoscaler/events?policyId=${policyId}`);
    expect(status).toBe(200);
    expect((body as any).events.length).toBeGreaterThan(0);
    expect((body as any).events.every((e: any) => e.action !== 'NO_ACTION')).toBe(true);
  });
});
