import { describe, it, expect } from 'vitest';
import {
  classifyLiveness,
  LIVENESS_ONLINE_WINDOW_MS,
  LIVENESS_STALE_WINDOW_MS,
  DEFAULT_LIVENESS_THRESHOLDS,
} from '../../modules/runtime-registration/liveness.js';

/**
 * ATLAS 46.23 — Part B: the liveness decision (heartbeat timestamp + now +
 * thresholds -> ONLINE|STALE|OFFLINE) as a pure function. No database, no
 * HTTP server, no real clock, no sleep — every case below supplies its own
 * fixed `now`, so this suite is fast and can never flake on timing.
 */

const NOW = new Date('2026-08-28T12:00:00.000Z');

function isoBefore(now: Date, msBefore: number): string {
  return new Date(now.getTime() - msBefore).toISOString();
}

describe('ATLAS 46.23 — classifyLiveness (pure function)', () => {
  it('1. a recent heartbeat (well within the ONLINE window) classifies as ONLINE', () => {
    const lastHeartbeat = isoBefore(NOW, 1_000); // 1s ago
    expect(classifyLiveness(lastHeartbeat, NOW)).toBe('ONLINE');
  });

  it('2. a heartbeat exactly at the ONLINE boundary still classifies as ONLINE (inclusive)', () => {
    const lastHeartbeat = isoBefore(NOW, LIVENESS_ONLINE_WINDOW_MS);
    expect(classifyLiveness(lastHeartbeat, NOW)).toBe('ONLINE');
  });

  it('3. immediately beyond the ONLINE boundary classifies as STALE', () => {
    const lastHeartbeat = isoBefore(NOW, LIVENESS_ONLINE_WINDOW_MS + 1);
    expect(classifyLiveness(lastHeartbeat, NOW)).toBe('STALE');
  });

  it('4. a heartbeat exactly at the STALE boundary still classifies as STALE (inclusive)', () => {
    const lastHeartbeat = isoBefore(NOW, LIVENESS_STALE_WINDOW_MS);
    expect(classifyLiveness(lastHeartbeat, NOW)).toBe('STALE');
  });

  it('5. immediately beyond the STALE boundary classifies as OFFLINE', () => {
    const lastHeartbeat = isoBefore(NOW, LIVENESS_STALE_WINDOW_MS + 1);
    expect(classifyLiveness(lastHeartbeat, NOW)).toBe('OFFLINE');
  });

  it('6. no heartbeat ever recorded (null) classifies as OFFLINE — never observed, not "was up and aged out"', () => {
    expect(classifyLiveness(null, NOW)).toBe('OFFLINE');
  });

  it('7. a heartbeat timestamp in the future (clock skew) is clamped to a zero gap and classifies as ONLINE, never crashes or produces an undefined state', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString(); // 1 minute in the future
    expect(classifyLiveness(future, NOW)).toBe('ONLINE');

    const farFuture = new Date(NOW.getTime() + 60 * 60_000).toISOString(); // 1 hour in the future
    expect(classifyLiveness(farFuture, NOW)).toBe('ONLINE');
  });

  it('8. classification is a pure function of (lastHeartbeat, now, thresholds) — calling it again with identical inputs (simulating "after a restart") produces an identical result', () => {
    const lastHeartbeat = isoBefore(NOW, 2 * 60_000); // 2 minutes ago -> STALE
    const first = classifyLiveness(lastHeartbeat, NOW);
    const second = classifyLiveness(lastHeartbeat, NOW); // fresh call, no shared state at all
    expect(first).toBe('STALE');
    expect(second).toBe(first);
  });

  it('accepts custom thresholds instead of always using the module defaults', () => {
    const lastHeartbeat = isoBefore(NOW, 10_000); // 10s ago
    expect(
      classifyLiveness(lastHeartbeat, NOW, { onlineWindowMs: 5_000, staleWindowMs: 20_000 })
    ).toBe('STALE');
    expect(
      classifyLiveness(lastHeartbeat, NOW, { onlineWindowMs: 15_000, staleWindowMs: 20_000 })
    ).toBe('ONLINE');
  });

  it('the exported default thresholds are exactly what DEFAULT_LIVENESS_THRESHOLDS documents (centralized, not duplicated as magic numbers elsewhere)', () => {
    expect(DEFAULT_LIVENESS_THRESHOLDS).toEqual({
      onlineWindowMs: LIVENESS_ONLINE_WINDOW_MS,
      staleWindowMs: LIVENESS_STALE_WINDOW_MS,
    });
    expect(LIVENESS_ONLINE_WINDOW_MS).toBeLessThan(LIVENESS_STALE_WINDOW_MS);
  });
});
