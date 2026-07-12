import { describe, it, expect, beforeEach } from 'vitest';
import { HealthChecker, makeSimulatedCheck } from '../health-check.js';

function makeChecker() {
  return new HealthChecker();
}

describe('HealthChecker — single checks', () => {
  it('healthy check returns status=healthy', async () => {
    const checker = makeChecker();
    checker.register('db', makeSimulatedCheck('db', 0, 'healthy'));
    const report = await checker.run();
    expect(report.status).toBe('healthy');
    expect(report.checks[0]!.status).toBe('healthy');
  });

  it('unhealthy check makes report unhealthy', async () => {
    const checker = makeChecker();
    checker.register('db', makeSimulatedCheck('db', 0, 'unhealthy', 'Connection refused'));
    const report = await checker.run();
    expect(report.status).toBe('unhealthy');
  });

  it('degraded check makes report degraded', async () => {
    const checker = makeChecker();
    checker.register('cache', makeSimulatedCheck('cache', 0, 'degraded', 'High latency'));
    const report = await checker.run();
    expect(report.status).toBe('degraded');
  });
});

describe('HealthChecker — aggregate status', () => {
  it('all healthy → report is healthy', async () => {
    const checker = makeChecker();
    checker.register('a', makeSimulatedCheck('a', 0, 'healthy'));
    checker.register('b', makeSimulatedCheck('b', 0, 'healthy'));
    checker.register('c', makeSimulatedCheck('c', 0, 'healthy'));
    const report = await checker.run();
    expect(report.status).toBe('healthy');
    expect(report.checks).toHaveLength(3);
  });

  it('one degraded among healthy → report is degraded', async () => {
    const checker = makeChecker();
    checker.register('a', makeSimulatedCheck('a', 0, 'healthy'));
    checker.register('b', makeSimulatedCheck('b', 0, 'degraded'));
    checker.register('c', makeSimulatedCheck('c', 0, 'healthy'));
    const report = await checker.run();
    expect(report.status).toBe('degraded');
  });

  it('one unhealthy overrides degraded → report is unhealthy', async () => {
    const checker = makeChecker();
    checker.register('a', makeSimulatedCheck('a', 0, 'healthy'));
    checker.register('b', makeSimulatedCheck('b', 0, 'degraded'));
    checker.register('c', makeSimulatedCheck('c', 0, 'unhealthy'));
    const report = await checker.run();
    expect(report.status).toBe('unhealthy');
  });

  it('no checks registered → report is healthy', async () => {
    const checker = makeChecker();
    const report = await checker.run();
    expect(report.status).toBe('healthy');
    expect(report.checks).toHaveLength(0);
  });
});

describe('HealthChecker — error handling', () => {
  it('throwing check fn is caught and marked unhealthy', async () => {
    const checker = makeChecker();
    checker.register('exploding', async () => {
      throw new Error('ECONNREFUSED');
    });
    const report = await checker.run();
    expect(report.status).toBe('unhealthy');
    expect(report.checks[0]!.message).toContain('ECONNREFUSED');
  });
});

describe('HealthChecker — runOne', () => {
  it('runOne returns result for known check', async () => {
    const checker = makeChecker();
    checker.register('db', makeSimulatedCheck('db', 0, 'healthy'));
    const result = await checker.runOne('db');
    expect(result?.status).toBe('healthy');
  });

  it('runOne returns null for unknown check', async () => {
    const checker = makeChecker();
    expect(await checker.runOne('unknown')).toBeNull();
  });
});

describe('HealthChecker — deregister', () => {
  it('deregistered check no longer appears in report', async () => {
    const checker = makeChecker();
    checker.register('a', makeSimulatedCheck('a', 0, 'healthy'));
    checker.register('b', makeSimulatedCheck('b', 0, 'unhealthy'));
    checker.deregister('b');
    const report = await checker.run();
    expect(report.status).toBe('healthy');
    expect(report.checks).toHaveLength(1);
  });
});

describe('HealthReport structure', () => {
  it('report includes version, uptime, and timestamp', async () => {
    const checker = makeChecker();
    const report = await checker.run();
    expect(report.version).toBeTruthy();
    expect(typeof report.uptime).toBe('number');
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
