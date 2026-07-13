export enum HealthStatus {
  ONLINE = 'ONLINE',
  STALE = 'STALE',
  OFFLINE = 'OFFLINE',
}

export const HEALTH_ONLINE_THRESHOLD_MS = 2 * 60 * 1_000; // < 2 min  → ONLINE
export const HEALTH_STALE_THRESHOLD_MS = 10 * 60 * 1_000; // 2–10 min → STALE (else OFFLINE)

/**
 * Computes the real-time health status of an agent from its last heartbeat.
 * Never persisted — always re-derived from the current wall clock.
 */
export function computeHealth(lastHeartbeat: Date | null | undefined): HealthStatus {
  if (!lastHeartbeat) return HealthStatus.OFFLINE;
  const elapsed = Date.now() - lastHeartbeat.getTime();
  if (elapsed < HEALTH_ONLINE_THRESHOLD_MS) return HealthStatus.ONLINE;
  if (elapsed < HEALTH_STALE_THRESHOLD_MS) return HealthStatus.STALE;
  return HealthStatus.OFFLINE;
}
