/**
 * ATLAS 46.23 — Runtime liveness (ONLINE / STALE / OFFLINE), derived
 * entirely from data already persisted by ATLAS 46.22
 * (`RuntimeRegistration.lastHeartbeat` — see runtime-registration.repository.ts).
 * This is NOT a second state machine: `status` (PENDING/REGISTERED/ACTIVE/
 * BLOCKED/REVOKED — see types.ts) keeps its existing meaning as the
 * Runtime's *registration lifecycle* state, set by explicit actions
 * (register, heartbeat-activation, block, reactivate, revoke). Liveness is
 * an orthogonal, purely computed *operational* signal — "is this Runtime
 * currently checking in" — recomputed fresh on every read from
 * `lastHeartbeat` and the current time. Nothing about liveness is ever
 * written to the database; there is no cache and no background sweep.
 *
 * A blocked/revoked Runtime cannot receive new heartbeats (see
 * routes/v1/runtime-registration/heartbeat.ts's BLOCKED/REVOKED guard), so
 * its `lastHeartbeat` simply stops advancing and its liveness naturally
 * decays to STALE, then OFFLINE, with no special-casing needed here.
 */

export type RuntimeLiveness = 'ONLINE' | 'STALE' | 'OFFLINE';

/**
 * ONLINE window: 2x the default heartbeat cadence a Runtime is configured
 * to use (`DEFAULT_RUNTIME_CONFIG.heartbeatIntervalMs` in
 * runtime-registration-store.ts, 30s) — tolerates exactly one missed beat
 * (network jitter, a slow discovery job blocking the client's event loop)
 * before downgrading, a standard heartbeat-monitoring margin. Not the same
 * constant reused verbatim, because "configured send interval" and "how
 * long until we call it offline" are different concepts even though this
 * one is derived from that one.
 */
export const LIVENESS_ONLINE_WINDOW_MS = 60_000; // 2 x 30s

/**
 * STALE window: reuses, unchanged, the `maxHeartbeatGapMs` policy value
 * already advertised to every Runtime at registration time
 * (routes/v1/runtime-registration/register.ts's `policies.maxHeartbeatGapMs`,
 * 5 minutes) — the point already documented, before this sprint, as "the
 * maximum acceptable gap between heartbeats". Reused as-is, not
 * reinterpreted: beyond this gap, a Runtime is OFFLINE.
 */
export const LIVENESS_STALE_WINDOW_MS = 5 * 60_000; // matches register.ts's policies.maxHeartbeatGapMs

export interface LivenessThresholds {
  onlineWindowMs: number;
  staleWindowMs: number;
}

export const DEFAULT_LIVENESS_THRESHOLDS: LivenessThresholds = {
  onlineWindowMs: LIVENESS_ONLINE_WINDOW_MS,
  staleWindowMs: LIVENESS_STALE_WINDOW_MS,
};

/**
 * Pure function: (lastHeartbeat, now, thresholds) -> liveness. No database,
 * no global clock, no process/singleton/cache access — `now` is always
 * supplied by the caller, so this is fully deterministic and independent
 * of anything a restart could lose.
 *
 * Boundary semantics (both windows inclusive on their near edge):
 *   gap <= onlineWindowMs                      -> ONLINE
 *   onlineWindowMs < gap <= staleWindowMs       -> STALE
 *   gap > staleWindowMs                         -> OFFLINE
 *
 * `lastHeartbeat === null` (never checked in, e.g. freshly REGISTERED with
 * no heartbeat yet) is defined as OFFLINE — not ONLINE (nothing was ever
 * observed) and not STALE (STALE implies it was previously seen and is now
 * aging out; a Runtime that never reported at all was never "up" from
 * liveness's point of view).
 *
 * A `lastHeartbeat` in the future (clock skew between processes — this
 * value is always server-assigned at write time, never client-supplied,
 * see runtime-registration.repository.ts's recordHeartbeat) produces a
 * negative gap, clamped to 0 rather than treated as an error: the safe,
 * explicit behavior is "we just saw it" (ONLINE), never a crash or an
 * exploitable way to force a different classification, since the value
 * that produces this is never attacker-controlled.
 */
export function classifyLiveness(
  lastHeartbeat: string | null,
  now: Date,
  thresholds: LivenessThresholds = DEFAULT_LIVENESS_THRESHOLDS
): RuntimeLiveness {
  if (!lastHeartbeat) return 'OFFLINE';

  const lastHeartbeatMs = new Date(lastHeartbeat).getTime();
  const gapMs = Math.max(0, now.getTime() - lastHeartbeatMs);

  if (gapMs <= thresholds.onlineWindowMs) return 'ONLINE';
  if (gapMs <= thresholds.staleWindowMs) return 'STALE';
  return 'OFFLINE';
}
