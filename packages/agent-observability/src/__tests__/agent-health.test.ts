import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeHealth,
  HealthStatus,
  HEALTH_ONLINE_THRESHOLD_MS,
  HEALTH_STALE_THRESHOLD_MS,
} from '../services/agent-health.js';

const NOW = new Date('2025-01-01T12:00:00.000Z').getTime();

function msAgo(ms: number): Date {
  return new Date(NOW - ms);
}

describe('computeHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('returns OFFLINE when lastHeartbeat is null', () => {
    expect(computeHealth(null)).toBe(HealthStatus.OFFLINE);
  });

  it('returns OFFLINE when lastHeartbeat is undefined', () => {
    expect(computeHealth(undefined)).toBe(HealthStatus.OFFLINE);
  });

  it('returns ONLINE for a heartbeat 1 ms ago', () => {
    expect(computeHealth(msAgo(1))).toBe(HealthStatus.ONLINE);
  });

  it('returns ONLINE just before the ONLINE threshold', () => {
    expect(computeHealth(msAgo(HEALTH_ONLINE_THRESHOLD_MS - 1))).toBe(HealthStatus.ONLINE);
  });

  it('returns STALE at exactly the ONLINE threshold boundary', () => {
    expect(computeHealth(msAgo(HEALTH_ONLINE_THRESHOLD_MS))).toBe(HealthStatus.STALE);
  });

  it('returns STALE for a heartbeat 5 minutes ago', () => {
    expect(computeHealth(msAgo(5 * 60 * 1_000))).toBe(HealthStatus.STALE);
  });

  it('returns STALE exactly 1 ms before the STALE threshold', () => {
    expect(computeHealth(msAgo(HEALTH_STALE_THRESHOLD_MS - 1))).toBe(HealthStatus.STALE);
  });

  it('returns OFFLINE at exactly the STALE threshold', () => {
    expect(computeHealth(msAgo(HEALTH_STALE_THRESHOLD_MS))).toBe(HealthStatus.OFFLINE);
  });

  it('returns OFFLINE for a heartbeat 30 minutes ago', () => {
    expect(computeHealth(msAgo(30 * 60 * 1_000))).toBe(HealthStatus.OFFLINE);
  });

  it('returns OFFLINE for a very old heartbeat', () => {
    expect(computeHealth(msAgo(24 * 60 * 60 * 1_000))).toBe(HealthStatus.OFFLINE);
  });

  it('ONLINE_THRESHOLD is 2 minutes in ms', () => {
    expect(HEALTH_ONLINE_THRESHOLD_MS).toBe(2 * 60 * 1_000);
  });

  it('STALE_THRESHOLD is 10 minutes in ms', () => {
    expect(HEALTH_STALE_THRESHOLD_MS).toBe(10 * 60 * 1_000);
  });
});
