import { describe, it, expect, beforeEach } from 'vitest';
import {
  LatencyHistogram,
  ThroughputCounter,
  ErrorRateTracker,
  MetricsCollector,
} from '../metrics-collector.js';

describe('LatencyHistogram', () => {
  it('p50/p95/p99 with sorted samples', () => {
    const h = new LatencyHistogram();
    for (let i = 1; i <= 100; i++) h.record(i);
    const stats = h.getStats();
    expect(stats.count).toBe(100);
    expect(stats.p50).toBe(50);
    expect(stats.p95).toBe(95);
    expect(stats.p99).toBe(99);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(100);
    expect(stats.mean).toBeCloseTo(50.5, 0);
  });

  it('empty histogram returns zeros', () => {
    const h = new LatencyHistogram();
    const stats = h.getStats();
    expect(stats.count).toBe(0);
    expect(stats.p99).toBe(0);
  });

  it('single sample equals all percentiles', () => {
    const h = new LatencyHistogram();
    h.record(42);
    const stats = h.getStats();
    expect(stats.p50).toBe(42);
    expect(stats.p95).toBe(42);
    expect(stats.p99).toBe(42);
  });

  it('reset clears samples', () => {
    const h = new LatencyHistogram();
    h.record(10);
    h.reset();
    expect(h.getStats().count).toBe(0);
  });
});

describe('ThroughputCounter', () => {
  it('totalRequests increments with each record', () => {
    const t = new ThroughputCounter(60_000);
    t.record();
    t.record();
    t.record();
    expect(t.getStats().totalRequests).toBe(3);
  });

  it('RPS is non-negative', () => {
    const t = new ThroughputCounter(60_000);
    for (let i = 0; i < 10; i++) t.record();
    expect(t.getStats().requestsPerSecond).toBeGreaterThanOrEqual(0);
  });

  it('reset clears all counts', () => {
    const t = new ThroughputCounter();
    t.record();
    t.record();
    t.reset();
    expect(t.getStats().totalRequests).toBe(0);
  });
});

describe('ErrorRateTracker', () => {
  it('tracks error rate correctly', () => {
    const e = new ErrorRateTracker();
    e.record(false);
    e.record(false);
    e.record(true, 'DB timeout');
    const stats = e.getStats();
    expect(stats.totalCount).toBe(3);
    expect(stats.errorCount).toBe(1);
    expect(stats.errorRate).toBeCloseTo(0.3333, 3);
    expect(stats.lastError).toBe('DB timeout');
  });

  it('zero errors gives rate 0', () => {
    const e = new ErrorRateTracker();
    e.record(false);
    e.record(false);
    expect(e.getStats().errorRate).toBe(0);
  });

  it('empty tracker gives rate 0', () => {
    expect(new ErrorRateTracker().getStats().errorRate).toBe(0);
  });

  it('reset clears counts', () => {
    const e = new ErrorRateTracker();
    e.record(true);
    e.reset();
    expect(e.getStats().errorCount).toBe(0);
  });
});

describe('MetricsCollector', () => {
  let mc: MetricsCollector;
  beforeEach(() => {
    mc = new MetricsCollector();
  });

  it('snapshot returns all three metric categories', () => {
    mc.record(100);
    mc.record(200, true, '/api/test', 'err');
    const snap = mc.snapshot();
    expect(snap.latency.count).toBe(2);
    expect(snap.throughput.totalRequests).toBe(2);
    expect(snap.errorRate.errorCount).toBe(1);
  });

  it('routeStats tracks per-route latency', () => {
    mc.record(50, false, '/api/users');
    mc.record(150, false, '/api/users');
    mc.record(300, false, '/api/jobs');
    const stats = mc.routeStats('/api/users');
    expect(stats?.count).toBe(2);
    expect(stats?.mean).toBeCloseTo(100, 0);
  });

  it('topRoutes sorts by count desc', () => {
    for (let i = 0; i < 5; i++) mc.record(10, false, '/a');
    for (let i = 0; i < 2; i++) mc.record(10, false, '/b');
    const top = mc.topRoutes(2);
    expect(top[0]!.route).toBe('/a');
    expect(top[1]!.route).toBe('/b');
  });

  it('reset clears all metrics', () => {
    mc.record(100, true);
    mc.reset();
    const snap = mc.snapshot();
    expect(snap.latency.count).toBe(0);
    expect(snap.errorRate.errorCount).toBe(0);
  });
});
