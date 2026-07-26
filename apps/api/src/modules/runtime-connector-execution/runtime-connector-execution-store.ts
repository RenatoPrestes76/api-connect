import { randomUUID } from 'node:crypto';
import { CircuitBreakerRegistry } from '@seltriva/titan';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { connectorsStore } from '../connectors/connectors-store.js';
import { erpConnectivityStore } from '../erp-connectivity/erp-connectivity-store.js';
import { buildExecutionPlan } from './query-planner.js';
import { validateExecution } from './execution-validator.js';
import { normalizeResult } from './result-normalizer.js';
import { computeBackoffDelayMs, DEFAULT_MAX_ATTEMPTS, DEFAULT_TIMEOUT_MS } from './retry-policy.js';
import type {
  ExecutionPlanRecord,
  ExecutionPlanDTO,
  ExecutionLifecycleStatus,
  ExecutionCircuitState,
  CreateExecutionInput,
  CreateExecutionError,
  ReportExecutionResultInput,
  ReportResultError,
} from './types.js';
import { TERMINAL_EXECUTION_STATUSES } from './types.js';

export type CreateExecutionResult =
  | { ok: true; plan: ExecutionPlanRecord }
  | { ok: false; error: CreateExecutionError };
export type ReportResultResult =
  | { ok: true; plan: ExecutionPlanRecord; alreadyReported: boolean }
  | { ok: false; error: ReportResultError };

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_TIMEOUT_MS = 60_000;

let _instance: RuntimeConnectorExecutionStore | null = null;

export class RuntimeConnectorExecutionStore {
  private plans: ExecutionPlanRecord[] = [];
  private circuits = new CircuitBreakerRegistry();

  static getInstance(): RuntimeConnectorExecutionStore {
    if (!_instance) _instance = new RuntimeConnectorExecutionStore();
    return _instance;
  }

  // ─── Query Planner + Execution Validator (create) ────────────────────────

  createExecution(input: CreateExecutionInput): CreateExecutionResult {
    const runtime = runtimeRegistrationStore.getRuntime(input.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };
    if (runtime.organizationId !== input.organizationId) {
      return { ok: false, error: 'RUNTIME_ORGANIZATION_MISMATCH' };
    }
    const connector = connectorsStore.getConnector(input.connectorId);
    if (!connector) return { ok: false, error: 'CONNECTOR_NOT_FOUND' };
    const profile = erpConnectivityStore.getProfile(input.profileId);
    if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' };
    if (profile.runtimeId !== input.runtimeId)
      return { ok: false, error: 'PROFILE_RUNTIME_MISMATCH' };

    const plannedQuery = buildExecutionPlan({
      action: input.action,
      payload: input.payload ?? {},
      dbType: profile.dbType,
    });
    const validation = validateExecution({
      runtime,
      connector,
      profile,
      action: plannedQuery.action,
      payload: plannedQuery.payload,
    });

    const now = new Date().toISOString();
    const plan: ExecutionPlanRecord = {
      id: randomUUID(),
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      connectorId: input.connectorId,
      profileId: input.profileId,
      action: plannedQuery.action,
      createdBy: input.createdBy,
      payload: plannedQuery.payload,
      dbType: plannedQuery.dbType,
      driverVersion: plannedQuery.driverVersion,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      attempts: 0,
      status: validation.ok ? 'QUEUED' : 'REJECTED',
      validation: validation.checks,
      metrics: {
        executionTimeMs: null,
        latencyMs: null,
        retries: 0,
        timeoutCount: 0,
        failureCount: 0,
        successRate: 100,
      },
      circuitState: 'CLOSED',
      resultData: null,
      resultError: validation.ok ? null : `Validation failed: ${validation.failureReason}`,
      erpReference: null,
      createdAt: now,
      scheduledAt: now,
      claimedAt: null,
      finishedAt: validation.ok ? null : now,
    };
    this.plans.push(plan);
    return { ok: true, plan };
  }

  getExecution(id: string): ExecutionPlanRecord | undefined {
    return this.plans.find((p) => p.id === id);
  }

  listExecutions(
    filter: { runtimeId?: string; organizationId?: string; status?: ExecutionLifecycleStatus } = {}
  ): ExecutionPlanRecord[] {
    return this.plans.filter((p) => {
      if (filter.runtimeId && p.runtimeId !== filter.runtimeId) return false;
      if (filter.organizationId && p.organizationId !== filter.organizationId) return false;
      if (filter.status && p.status !== filter.status) return false;
      return true;
    });
  }

  toDTO(plan: ExecutionPlanRecord): ExecutionPlanDTO {
    return {
      id: plan.id,
      runtimeId: plan.runtimeId,
      organizationId: plan.organizationId,
      connectorId: plan.connectorId,
      profileId: plan.profileId,
      action: plan.action,
      createdBy: plan.createdBy,
      payload: plan.payload,
      dbType: plan.dbType,
      driverVersion: plan.driverVersion,
      timeoutMs: plan.timeoutMs,
      maxAttempts: plan.maxAttempts,
      attempts: plan.attempts,
      status: plan.status,
      validation: plan.validation,
      metrics: plan.metrics,
      circuitState: plan.circuitState,
      resultData: plan.resultData,
      resultError: plan.resultError,
      erpReference: plan.erpReference,
      createdAt: plan.createdAt,
      scheduledAt: plan.scheduledAt,
      claimedAt: plan.claimedAt,
      finishedAt: plan.finishedAt,
    };
  }

  // ─── Claim (Runtime polls GET /runtime/connectors/jobs) ──────────────────

  private evaluateTimeout(plan: ExecutionPlanRecord): ExecutionPlanRecord {
    if (TERMINAL_EXECUTION_STATUSES.includes(plan.status)) return plan;
    if (plan.status !== 'CLAIMED' && plan.status !== 'EXECUTING') return plan;

    const startedAt = plan.claimedAt ?? plan.createdAt;
    const elapsed = Date.now() - new Date(startedAt).getTime();
    if (elapsed > plan.timeoutMs) {
      this.recordFailure(plan, 'Execution timed out', true);
    }
    return plan;
  }

  private circuitStateFor(connectorId: string, profileId: string): ExecutionCircuitState {
    return (
      this.circuits.get(`connector-execution:${connectorId}:${profileId}`)?.getState() ?? 'CLOSED'
    );
  }

  claimExecutionsForRuntime(runtimeId: string): ExecutionPlanRecord[] {
    const now = Date.now();
    const claimable = this.plans
      .map((p) => this.evaluateTimeout(p))
      .filter((p) => {
        if (p.runtimeId !== runtimeId || p.status !== 'QUEUED') return false;
        if (new Date(p.scheduledAt).getTime() > now) return false;
        // An OPEN circuit for this connector+profile means recent attempts
        // have been failing hard — don't hand the Runtime more work against
        // it until the breaker allows a trial (HALF_OPEN) request.
        if (this.circuitStateFor(p.connectorId, p.profileId) === 'OPEN') return false;
        return true;
      });

    const claimedAt = new Date().toISOString();
    for (const plan of claimable) {
      plan.status = 'CLAIMED';
      plan.claimedAt = claimedAt;
    }
    return claimable;
  }

  // ─── Result Normalizer + retry/circuit breaker (report) ──────────────────

  private recordFailure(plan: ExecutionPlanRecord, error: string, isTimeout: boolean): void {
    plan.attempts += 1;
    plan.metrics.failureCount += 1;
    if (isTimeout) plan.metrics.timeoutCount += 1;
    plan.resultError = error;

    if (plan.attempts < plan.maxAttempts) {
      plan.status = 'QUEUED';
      plan.claimedAt = null;
      plan.metrics.retries += 1;
      plan.scheduledAt = new Date(Date.now() + computeBackoffDelayMs(plan.attempts)).toISOString();
    } else {
      plan.status = isTimeout ? 'TIMEOUT' : 'FAILED';
      plan.finishedAt = new Date().toISOString();
    }
  }

  /**
   * Records a Runtime-reported execution outcome. Idempotent on an
   * already-terminal plan (a retried result report is a silent no-op,
   * matching job-orchestration's reportResult convention) — the circuit
   * breaker (reused from packages/titan) gates whether repeated failures
   * for this connector+profile combination should keep being attempted.
   */
  async reportResult(input: ReportExecutionResultInput): Promise<ReportResultResult> {
    const plan = this.getExecution(input.executionId);
    if (!plan) return { ok: false, error: 'EXECUTION_NOT_FOUND' };
    if (plan.runtimeId !== input.runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    if (TERMINAL_EXECUTION_STATUSES.includes(plan.status)) {
      return { ok: true, plan, alreadyReported: true };
    }

    const breaker = this.circuits.register(
      `connector-execution:${plan.connectorId}:${plan.profileId}`,
      {
        failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
        timeout: CIRCUIT_TIMEOUT_MS,
      }
    );
    try {
      await breaker.execute(async () => {
        if (!input.success) throw new Error(input.error ?? 'Execution reported failure');
      });
    } catch {
      // CircuitOpenError or the wrapped failure — state already recorded via recordFailure below.
    }
    plan.circuitState = breaker.getState();

    const outcome = normalizeResult(input);
    if (input.executionTimeMs !== undefined) plan.metrics.executionTimeMs = input.executionTimeMs;
    if (input.latencyMs !== undefined) plan.metrics.latencyMs = input.latencyMs;

    if (input.erpReference !== undefined) plan.erpReference = input.erpReference;

    if (outcome === 'SUCCESS' || outcome === 'PARTIAL' || outcome === 'EMPTY') {
      plan.attempts += 1;
      plan.status = outcome;
      plan.resultData = input.data ?? {};
      plan.resultError = null;
      plan.finishedAt = new Date().toISOString();
    } else if (outcome === 'UNAUTHORIZED') {
      plan.attempts += 1;
      plan.status = 'UNAUTHORIZED';
      plan.resultError = input.error ?? 'Unauthorized';
      plan.finishedAt = new Date().toISOString();
    } else {
      // FAILED or TIMEOUT — subject to retry/backoff before becoming terminal.
      // recordFailure() owns incrementing `attempts` for this path.
      this.recordFailure(
        plan,
        input.error ?? `Execution ${outcome.toLowerCase()}`,
        outcome === 'TIMEOUT'
      );
    }
    plan.metrics.successRate = Math.round(
      ((plan.attempts - plan.metrics.failureCount) / plan.attempts) * 100
    );

    return { ok: true, plan, alreadyReported: false };
  }
}

export const runtimeConnectorExecutionStore = RuntimeConnectorExecutionStore.getInstance();
