import { leaderElection } from '../ha/leader-election.js';
import { haStore } from '../ha/ha-store.js';
import { loadBalancer } from '../ha/load-balancer.js';
import { recoveryService } from '../ha/recovery-service.js';
import { fleetOpsStore } from '../fleet-ops/fleet-ops-store.js';
import { autoscaler } from '../fleet-ops/autoscaler.js';
import { controlPlaneStore } from '../control-plane/control-plane-store.js';
import { regionsStore } from '../regions/regions-store.js';
import type { ChaosScenarioResult, ChaosScenarioType, ChaosSuiteResult } from './types.js';

const ALL_SCENARIOS: ChaosScenarioType[] = [
  'node_failure_election',
  'backup_restore_cycle',
  'load_balancer_failover',
  'deployment_rollback',
  'region_failover',
  'autoscaler_load_spike',
];

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ScenarioOutcome {
  passed: boolean;
  summary: string;
  details: Record<string, unknown>;
}

/**
 * Chaos testing module (Sprint 47 / ATLAS FORTRESS). Each scenario exercises a REAL resilience
 * mechanism built this sprint by calling directly into its module (leaderElection, backupService/
 * recoveryService, loadBalancer, fleetOpsStore's deployment engine, regionsStore's geo-failover,
 * the autoscaler) and asserts on genuinely observed before/after state — not a canned "passed".
 * A scenario that can't find the seed data it needs reports passed:false with an honest reason,
 * rather than fabricating a result.
 */
class ChaosRunner {
  private history: ChaosScenarioResult[] = [];

  getHistory(limit = 50): ChaosScenarioResult[] {
    return this.history.slice(0, limit);
  }

  async run(type: ChaosScenarioType): Promise<ChaosScenarioResult> {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let outcome: ScenarioOutcome;

    try {
      switch (type) {
        case 'node_failure_election':
          outcome = this.runNodeFailureElection();
          break;
        case 'backup_restore_cycle':
          outcome = this.runBackupRestoreCycle();
          break;
        case 'load_balancer_failover':
          outcome = this.runLoadBalancerFailover();
          break;
        case 'deployment_rollback':
          outcome = this.runDeploymentRollback();
          break;
        case 'region_failover':
          outcome = this.runRegionFailover();
          break;
        case 'autoscaler_load_spike':
          outcome = this.runAutoscalerLoadSpike();
          break;
      }
    } catch (err) {
      outcome = {
        passed: false,
        summary: `Scenario threw: ${err instanceof Error ? err.message : String(err)}`,
        details: {},
      };
    }

    const result: ChaosScenarioResult = {
      id: genId('chaos'),
      type,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      passed: outcome.passed,
      summary: outcome.summary,
      details: outcome.details,
    };
    this.history.unshift(result);
    return result;
  }

  async runAll(): Promise<ChaosSuiteResult> {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const scenarios: ChaosScenarioResult[] = [];
    for (const type of ALL_SCENARIOS) {
      scenarios.push(await this.run(type));
    }
    const passed = scenarios.filter((s) => s.passed).length;
    return {
      id: genId('suite'),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      total: scenarios.length,
      passed,
      failed: scenarios.length - passed,
      scenarios,
    };
  }

  // ── Scenarios ────────────────────────────────────────────────────────────

  private runNodeFailureElection(): ScenarioOutcome {
    const before = haStore.getNodes({ role: 'leader' })[0];
    if (!before)
      return { passed: false, summary: 'No leader node found before the test', details: {} };

    leaderElection.simulateNodeFailure(before.id);
    const election = leaderElection.runElection({
      reason: 'chaos test: simulated leader failure',
      triggeredBy: 'automatic',
      force: true,
    });
    const after = haStore.getNodes({ role: 'leader' })[0];
    const passed = !!election && !!after && after.id !== before.id && after.status === 'online';

    return {
      passed,
      summary: passed
        ? `Automatic failover succeeded: ${before.hostname} -> ${after!.hostname}`
        : 'Automatic failover did not produce a healthy new leader',
      details: { failedNode: before.id, newLeader: after?.id ?? null, election },
    };
  }

  private runBackupRestoreCycle(): ScenarioOutcome {
    const test = recoveryService.runRecoveryTest('tenant-enterprise');
    return {
      passed: test.result === 'passed',
      summary: test.notes,
      details: { testId: test.id, rtoSeconds: test.rtoSeconds, rpoMinutes: test.rpoMinutes },
    };
  }

  private runLoadBalancerFailover(): ScenarioOutcome {
    const targets = haStore.getNodes({ status: 'online' }).filter((n) => n.role !== 'leader');
    const victim = targets[0];
    if (!victim) {
      return { passed: false, summary: 'No non-leader online node available to fail', details: {} };
    }

    leaderElection.simulateNodeFailure(victim.id);
    const routedTo = new Set<string>();
    try {
      for (let i = 0; i < 10; i++) {
        routedTo.add(loadBalancer.route('round_robin').nodeId);
      }
    } finally {
      leaderElection.recoverNode(victim.id);
    }

    const passed = !routedTo.has(victim.id);
    return {
      passed,
      summary: passed
        ? `Load balancer correctly avoided the failed node ${victim.hostname} across 10 routing decisions`
        : `Load balancer routed to the failed node ${victim.hostname}`,
      details: { failedNode: victim.id, routedTo: [...routedTo] },
    };
  }

  private runDeploymentRollback(): ScenarioOutcome {
    const org = controlPlaneStore.listOrganizations()[0];
    const env = org ? controlPlaneStore.listEnvironments({ organizationId: org.id })[0] : undefined;
    const connector = controlPlaneStore.listConnectors()[0];
    const version = connector ? controlPlaneStore.getConnectorVersions(connector.id)[0] : undefined;

    if (!org || !env || !connector || !version) {
      return {
        passed: false,
        summary:
          'Insufficient seed data (organization/environment/connector/version) to run this scenario',
        details: {},
      };
    }

    const job = fleetOpsStore.createDeploymentJob({
      organizationId: org.id,
      environmentId: env.id,
      pluginId: connector.id,
      pluginVersionId: version.id,
      mode: 'MANUAL',
      strategy: 'ROLLING',
    });
    fleetOpsStore.injectDeploymentFailure(job.id, 'Health check batch 2/3');
    const approved = fleetOpsStore.approveDeploymentJob(job.id, 'chaos-runner');
    const finalStatus = typeof approved === 'string' ? approved : approved.status;
    const passed = finalStatus === 'ROLLED_BACK';

    return {
      passed,
      summary: passed
        ? `Injected failure at "Health check batch 2/3" triggered automatic rollback for job ${job.id}`
        : `Deployment job did not roll back as expected (status: ${finalStatus})`,
      details: { jobId: job.id, finalStatus },
    };
  }

  private runRegionFailover(): ScenarioOutcome {
    const tenantId = 'tenant-community';
    const before = regionsStore.getTenantPlacement(tenantId);
    if (!before) return { passed: false, summary: `Tenant "${tenantId}" not found`, details: {} };

    const result = regionsStore.automaticGeoFailover(
      tenantId,
      'chaos test: simulated regional outage'
    );
    const passed =
      typeof result !== 'string' && result.success && result.toRegion !== before.primaryRegion;

    return {
      passed,
      summary:
        typeof result === 'string'
          ? `Automatic geo-failover did not run: ${result}`
          : result.message,
      details: { tenantId, fromRegion: before.primaryRegion, result },
    };
  }

  private runAutoscalerLoadSpike(): ScenarioOutcome {
    const runtime = controlPlaneStore.listRuntimes({ status: 'ONLINE' })[0];
    if (!runtime)
      return { passed: false, summary: 'No online runtime available to load-spike', details: {} };

    fleetOpsStore.recordHeartbeat(runtime.id, {
      cpuPct: 97,
      memPct: 40,
      diskPct: 20,
      latencyMs: 5,
    });
    const policy = autoscaler.createPolicy({
      organizationId: runtime.organizationId,
      environmentId: runtime.environmentId,
      minInstances: 1,
      maxInstances: 20,
      targetCpuPct: 80,
      targetMemPct: 80,
      cooldownMs: 0,
    });
    const evaluation = autoscaler.evaluate(policy.id);
    const passed = evaluation?.action === 'SCALE_UP';

    return {
      passed,
      summary: evaluation?.reason ?? 'Autoscaler evaluation produced no result',
      details: { policyId: policy.id, evaluation },
    };
  }
}

export const chaosRunner = new ChaosRunner();
