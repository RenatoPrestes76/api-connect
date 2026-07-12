import { fleetOpsStore } from './fleet-ops-store.js';
import { controlPlaneStore } from '../control-plane/control-plane-store.js';
import type { AutoscalePolicy, ScalingEvent, ScalingActionType } from './types.js';

const TICK_MS = 10_000;

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Horizontal autoscaler control loop (Sprint 47 / ATLAS FORTRESS). Watches real per-runtime
 * CPU/memory metrics recorded via fleetOpsStore.recordHeartbeat() and provisions/retires real
 * Runtime records via controlPlaneStore — not a fabricated "scaling event" feed. A pool is the
 * set of ONLINE runtimes for one (organizationId, environmentId) pair.
 */
class Autoscaler {
  private policies: AutoscalePolicy[] = [];
  private events: ScalingEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tickAll(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  createPolicy(input: {
    organizationId: string;
    environmentId: string;
    minInstances: number;
    maxInstances: number;
    targetCpuPct: number;
    targetMemPct: number;
    cooldownMs?: number;
    enabled?: boolean;
  }): AutoscalePolicy {
    const now = new Date().toISOString();
    const policy: AutoscalePolicy = {
      id: genId('asp'),
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      minInstances: input.minInstances,
      maxInstances: input.maxInstances,
      targetCpuPct: input.targetCpuPct,
      targetMemPct: input.targetMemPct,
      cooldownMs: input.cooldownMs ?? 60_000,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.policies.push(policy);
    return policy;
  }

  listPolicies(
    filters: { organizationId?: string; environmentId?: string } = {}
  ): AutoscalePolicy[] {
    let list = [...this.policies];
    if (filters.organizationId)
      list = list.filter((p) => p.organizationId === filters.organizationId);
    if (filters.environmentId) list = list.filter((p) => p.environmentId === filters.environmentId);
    return list;
  }

  getPolicy(id: string): AutoscalePolicy | undefined {
    return this.policies.find((p) => p.id === id);
  }

  updatePolicy(
    id: string,
    updates: Partial<
      Pick<
        AutoscalePolicy,
        'minInstances' | 'maxInstances' | 'targetCpuPct' | 'targetMemPct' | 'cooldownMs' | 'enabled'
      >
    >
  ): AutoscalePolicy | null {
    const policy = this.getPolicy(id);
    if (!policy) return null;
    Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
    return policy;
  }

  deletePolicy(id: string): boolean {
    const idx = this.policies.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.policies.splice(idx, 1);
    return true;
  }

  getEvents(policyId?: string, limit = 50): ScalingEvent[] {
    const list = policyId ? this.events.filter((e) => e.policyId === policyId) : this.events;
    return list.slice(0, limit);
  }

  private poolRuntimes(policy: AutoscalePolicy) {
    return controlPlaneStore.listRuntimes({
      organizationId: policy.organizationId,
      environmentId: policy.environmentId,
      status: 'ONLINE',
    });
  }

  private poolAverages(runtimes: ReturnType<Autoscaler['poolRuntimes']>): {
    avgCpuPct: number;
    avgMemPct: number;
    sampleCount: number;
  } {
    const metrics = runtimes
      .map((r) => fleetOpsStore.getLatestMetric(r.id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    if (metrics.length === 0) return { avgCpuPct: 0, avgMemPct: 0, sampleCount: 0 };
    const avgCpuPct = Math.round(metrics.reduce((s, m) => s + m.cpuPct, 0) / metrics.length);
    const avgMemPct = Math.round(metrics.reduce((s, m) => s + m.memPct, 0) / metrics.length);
    return { avgCpuPct, avgMemPct, sampleCount: metrics.length };
  }

  /** Evaluates one policy's pool now, taking a real provision/retire action if warranted. */
  evaluate(policyId: string): ScalingEvent | null {
    const policy = this.getPolicy(policyId);
    if (!policy) return null;

    const runtimes = this.poolRuntimes(policy);
    const { avgCpuPct, avgMemPct, sampleCount } = this.poolAverages(runtimes);
    const instancesBefore = runtimes.length;
    const inCooldown =
      !!policy.lastScaledAt &&
      Date.now() - new Date(policy.lastScaledAt).getTime() < policy.cooldownMs;

    let action: ScalingActionType = 'NO_ACTION';
    let instancesAfter = instancesBefore;
    let reason = `avgCpu=${avgCpuPct}% avgMem=${avgMemPct}% within target range`;

    if (!policy.enabled) {
      reason = 'policy disabled';
    } else if (sampleCount === 0) {
      reason = 'no metric data available for this pool yet';
    } else if (inCooldown) {
      reason = `cooldown active (${policy.cooldownMs}ms since last scaling action)`;
    } else if (avgCpuPct > policy.targetCpuPct || avgMemPct > policy.targetMemPct) {
      if (instancesBefore < policy.maxInstances) {
        const runtime = controlPlaneStore.provisionRuntime({
          organizationId: policy.organizationId,
          environmentId: policy.environmentId,
          namePrefix: 'autoscaled-worker',
        });
        action = 'SCALE_UP';
        instancesAfter = instancesBefore + 1;
        reason = `avgCpu=${avgCpuPct}% avgMem=${avgMemPct}% exceeded target (cpu>${policy.targetCpuPct}% or mem>${policy.targetMemPct}%) — provisioned ${runtime.name}`;
        policy.lastScaledAt = new Date().toISOString();
        policy.updatedAt = policy.lastScaledAt;
      } else {
        reason = `avgCpu=${avgCpuPct}% avgMem=${avgMemPct}% exceeded target but pool is already at maxInstances (${policy.maxInstances})`;
      }
    } else if (avgCpuPct < policy.targetCpuPct / 2 && avgMemPct < policy.targetMemPct / 2) {
      if (instancesBefore > policy.minInstances) {
        const candidate = runtimes[runtimes.length - 1]!;
        controlPlaneStore.retireRuntime(candidate.id);
        action = 'SCALE_DOWN';
        instancesAfter = instancesBefore - 1;
        reason = `avgCpu=${avgCpuPct}% avgMem=${avgMemPct}% well under half of target — retired ${candidate.name}`;
        policy.lastScaledAt = new Date().toISOString();
        policy.updatedAt = policy.lastScaledAt;
      } else {
        reason = `avgCpu=${avgCpuPct}% avgMem=${avgMemPct}% is low but pool is already at minInstances (${policy.minInstances})`;
      }
    }

    const event: ScalingEvent = {
      id: genId('scale'),
      policyId: policy.id,
      organizationId: policy.organizationId,
      environmentId: policy.environmentId,
      action,
      reason,
      instancesBefore,
      instancesAfter,
      avgCpuPct,
      avgMemPct,
      createdAt: new Date().toISOString(),
    };
    if (action !== 'NO_ACTION') this.events.unshift(event);
    return event;
  }

  private tickAll(): void {
    for (const policy of this.policies) {
      if (policy.enabled) this.evaluate(policy.id);
    }
  }
}

export const autoscaler = new Autoscaler();
autoscaler.start();
