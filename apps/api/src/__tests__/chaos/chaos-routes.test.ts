import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, superAdminAuth, type TestServer } from './helpers.js';

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

describe('POST /admin/chaos/run/:type', () => {
  it('rejects an invalid scenario type', async () => {
    const { status, body } = await P('/admin/chaos/run/not-a-real-scenario');
    expect(status).toBe(400);
    expect((body as any).error.code).toBe('INVALID_SCENARIO');
  });

  it('requires authentication', async () => {
    const { status } = await post(srv.baseUrl, '/admin/chaos/run/backup_restore_cycle', {}, {});
    expect(status).toBe(401);
  });

  it('node_failure_election: fails the leader, elects a new healthy one', async () => {
    const { status, body } = await P('/admin/chaos/run/node_failure_election');
    expect(status).toBe(201);
    const b = body as any;
    expect(b.type).toBe('node_failure_election');
    expect(b.passed).toBe(true);
    expect(b.details.newLeader).toBeTruthy();
    expect(b.details.newLeader).not.toBe(b.details.failedNode);
  });

  it('backup_restore_cycle: real capture/mutate/restore/verify passes', async () => {
    const { body } = await P('/admin/chaos/run/backup_restore_cycle');
    const b = body as any;
    expect(b.passed).toBe(true);
    expect(typeof b.details.rtoSeconds).toBe('number');
  });

  it('load_balancer_failover: routing avoids the failed node', async () => {
    const { body } = await P('/admin/chaos/run/load_balancer_failover');
    const b = body as any;
    expect(b.passed).toBe(true);
    expect(b.details.routedTo).not.toContain(b.details.failedNode);
  });

  it('deployment_rollback: injected failure triggers automatic rollback', async () => {
    const { body } = await P('/admin/chaos/run/deployment_rollback');
    const b = body as any;
    expect(b.passed).toBe(true);
    expect(b.details.finalStatus).toBe('ROLLED_BACK');
  });

  it('region_failover: tenant moves to a different active region', async () => {
    const { body } = await P('/admin/chaos/run/region_failover');
    const b = body as any;
    expect(b.passed).toBe(true);
    expect((b.details.result as any).toRegion).not.toBe(b.details.fromRegion);
  });

  it('autoscaler_load_spike: high CPU triggers a real SCALE_UP', async () => {
    const { body } = await P('/admin/chaos/run/autoscaler_load_spike');
    const b = body as any;
    expect(b.passed).toBe(true);
    expect(b.details.evaluation.action).toBe('SCALE_UP');
  });
});

describe('POST /admin/chaos/run-all', () => {
  it('runs every scenario and returns an aggregate pass/fail summary', async () => {
    const { status, body } = await P('/admin/chaos/run-all');
    expect(status).toBe(201);
    const b = body as any;
    expect(b.total).toBe(6);
    expect(b.passed + b.failed).toBe(6);
    expect(b.scenarios).toHaveLength(6);
  });
});

describe('GET /admin/chaos/history', () => {
  it('returns previously run scenarios, most recent first', async () => {
    await P('/admin/chaos/run/backup_restore_cycle');
    const { status, body } = await G('/admin/chaos/history?limit=5');
    expect(status).toBe(200);
    const b = body as any;
    expect(b.history.length).toBeGreaterThan(0);
    expect(b.history[0].type).toBe('backup_restore_cycle');
  });
});
