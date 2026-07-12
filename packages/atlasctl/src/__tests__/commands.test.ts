import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasCtl } from '../commands.js';

describe('AtlasCtl — login / logout', () => {
  let ctl: AtlasCtl;
  beforeEach(() => {
    ctl = new AtlasCtl();
  });

  it('login with valid token succeeds', () => {
    const r = ctl.login('atlas-token-secret');
    expect(r.status).toBe('ok');
    expect(r.command).toBe('login');
    expect(ctl.isAuthenticated()).toBe(true);
  });

  it('login with short token fails', () => {
    const r = ctl.login('short');
    expect(r.status).toBe('error');
    expect(r.error).toContain('Invalid token');
    expect(ctl.isAuthenticated()).toBe(false);
  });

  it('login sets custom namespace', () => {
    ctl.login('atlas-token-secret', 'atlas-staging');
    expect(ctl.getNamespace()).toBe('atlas-staging');
  });

  it('logout clears authentication', () => {
    ctl.login('atlas-token-secret');
    const r = ctl.logout();
    expect(r.status).toBe('ok');
    expect(ctl.isAuthenticated()).toBe(false);
    expect(ctl.getToken()).toBeNull();
  });
});

describe('AtlasCtl — status / health / version', () => {
  let ctl: AtlasCtl;
  beforeEach(() => {
    ctl = new AtlasCtl();
    ctl.login('atlas-token-secret');
  });

  it('status returns healthy cluster info', () => {
    const r = ctl.status();
    expect(r.status).toBe('ok');
    expect(r.data!.healthy).toBe(true);
    expect(r.data!.version).toBe('1.0.0');
    expect(r.data!.replicas.ready).toBe(3);
  });

  it('status returns error when not authenticated', () => {
    ctl.logout();
    const r = ctl.status();
    expect(r.status).toBe('error');
    expect(r.error).toContain('Not authenticated');
  });

  it('health returns healthy result', () => {
    const r = ctl.health();
    expect(r.status).toBe('ok');
    expect(r.data!.overall).toBe('healthy');
    expect(r.data!.agents).toBeGreaterThan(0);
  });

  it('version returns without requiring auth', () => {
    const ctl2 = new AtlasCtl();
    const r = ctl2.version();
    expect(r.status).toBe('ok');
    expect(r.data!.version).toBe('1.0.0');
    expect(r.data!.buildNumber).toBe(100);
  });

  it('all results include executedAt and durationMs', () => {
    const r = ctl.status();
    expect(r.executedAt).toBeTruthy();
    expect(typeof r.durationMs).toBe('number');
  });
});

describe('AtlasCtl — deploy', () => {
  let ctl: AtlasCtl;
  beforeEach(() => {
    ctl = new AtlasCtl();
    ctl.login('atlas-token-secret');
  });

  it('deploy with valid config returns jobId', () => {
    const r = ctl.deploy({
      image: 'ghcr.io/seltriva/atlas-api',
      tag: '1.0.0',
      strategy: 'rolling',
      namespace: 'atlas-production',
    });
    expect(r.status).toBe('ok');
    expect(r.data!.jobId).toMatch(/^deploy-/);
  });

  it('deploy fails without image', () => {
    const r = ctl.deploy({ image: '', tag: '1.0.0', strategy: 'rolling', namespace: 'prod' });
    expect(r.status).toBe('error');
  });

  it('deploy fails with invalid strategy', () => {
    const r = ctl.deploy({
      image: 'ghcr.io/seltriva/atlas-api',
      tag: '1.0.0',
      strategy: 'blue-green' as any,
      namespace: 'prod',
    });
    expect(r.status).toBe('error');
    expect(r.error).toContain('Invalid strategy');
  });

  it('deploy returns error when not authenticated', () => {
    ctl.logout();
    const r = ctl.deploy({ image: 'img', tag: '1.0.0', strategy: 'rolling', namespace: 'prod' });
    expect(r.status).toBe('error');
  });
});

describe('AtlasCtl — rollback / scale / restart', () => {
  let ctl: AtlasCtl;
  beforeEach(() => {
    ctl = new AtlasCtl();
    ctl.login('atlas-token-secret');
  });

  it('rollback with valid config succeeds', () => {
    const r = ctl.rollback({
      toVersion: '0.36.0',
      namespace: 'prod',
      reason: 'regression in v1.0.0',
    });
    expect(r.status).toBe('ok');
    expect(r.data!.toVersion).toBe('0.36.0');
    expect(r.data!.jobId).toMatch(/^rollback-/);
  });

  it('rollback requires reason', () => {
    const r = ctl.rollback({ toVersion: '0.36.0', namespace: 'prod', reason: '' });
    expect(r.status).toBe('error');
    expect(r.error).toContain('reason');
  });

  it('scale api to 5 replicas', () => {
    const r = ctl.scale({ service: 'api', replicas: 5, namespace: 'prod' });
    expect(r.status).toBe('ok');
    expect(r.data!.replicas).toBe(5);
  });

  it('scale fails with out-of-range replicas', () => {
    const r = ctl.scale({ service: 'api', replicas: 100, namespace: 'prod' });
    expect(r.status).toBe('error');
  });

  it('scale fails with invalid service', () => {
    const r = ctl.scale({ service: 'nginx' as any, replicas: 2, namespace: 'prod' });
    expect(r.status).toBe('error');
  });

  it('restart returns restarted=true', () => {
    const r = ctl.restart('api');
    expect(r.status).toBe('ok');
    expect(r.data!.restarted).toBe(true);
  });

  it('restart fails without service name', () => {
    const r = ctl.restart('');
    expect(r.status).toBe('error');
  });
});
