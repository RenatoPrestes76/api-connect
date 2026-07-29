import { randomUUID } from 'node:crypto';
import { sqlGeneratorStore } from '../sql-generator/sql-generator-store.js';
import { erpConnectivityStore } from '../erp-connectivity/erp-connectivity-store.js';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { processResultRows, paginateResult } from './result-processor.js';
import {
  computeBackoffDelayMs,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
  RUNTIME_OFFLINE_THRESHOLD_MS,
} from './retry-policy.js';
import type {
  CancelExecutionError,
  CreateExecutionError,
  CreateExecutionInput,
  QueryExecutionDTO,
  QueryExecutionRecord,
  QueryExecutionResult,
  ReportExecutionResultError,
  ReportExecutionResultInput,
} from './types.js';
import { TERMINAL_EXECUTION_STATUSES } from './types.js';

export type CreateExecutionResult =
  | { ok: true; execution: QueryExecutionRecord }
  | { ok: false; error: CreateExecutionError };
export type ReportResultResult =
  | { ok: true; execution: QueryExecutionRecord; alreadyReported: boolean }
  | { ok: false; error: ReportExecutionResultError };
export type CancelExecutionResult =
  | { ok: true; execution: QueryExecutionRecord }
  | { ok: false; error: CancelExecutionError };

let _instance: QueryExecutionStore | null = null;

export class QueryExecutionStore {
  private executions: QueryExecutionRecord[] = [];

  static getInstance(): QueryExecutionStore {
    if (!_instance) _instance = new QueryExecutionStore();
    return _instance;
  }

  createExecution(input: CreateExecutionInput): CreateExecutionResult {
    const generatedQuery = sqlGeneratorStore.getById(input.generatedQueryId);
    if (!generatedQuery) return { ok: false, error: 'GENERATED_QUERY_NOT_FOUND' };
    if (generatedQuery.organizationId !== input.organizationId) {
      return { ok: false, error: 'GENERATED_QUERY_ORGANIZATION_MISMATCH' };
    }

    const profile = erpConnectivityStore.getProfile(generatedQuery.profileId);
    if (!profile) return { ok: false, error: 'CONNECTION_PROFILE_NOT_FOUND' };

    const runtime = runtimeRegistrationStore.getRuntime(profile.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };

    const isOffline =
      !runtime.lastHeartbeat ||
      Date.now() - new Date(runtime.lastHeartbeat).getTime() > RUNTIME_OFFLINE_THRESHOLD_MS;
    if (isOffline) return { ok: false, error: 'RUNTIME_OFFLINE' };

    const now = new Date().toISOString();
    const execution: QueryExecutionRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      runtimeId: profile.runtimeId,
      profileId: profile.id,
      generatedQueryId: generatedQuery.id,
      queryPlanId: generatedQuery.queryPlanId,
      canonicalVersion: generatedQuery.canonicalVersion,
      sql: generatedQuery.sql,
      dialect: generatedQuery.dialect,
      parameters: generatedQuery.parameters,
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      error: null,
      storedRows: null,
      storedColumns: null,
      totalRows: null,
      requestedBy: input.requestedBy,
      createdAt: now,
      scheduledAt: now,
      dispatchedAt: null,
      finishedAt: null,
      durationMs: null,
      logs: [{ at: now, event: 'QUEUED' }],
    };
    this.executions.push(execution);
    return { ok: true, execution };
  }

  private finish(
    execution: QueryExecutionRecord,
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED'
  ): void {
    const now = new Date().toISOString();
    execution.status = status;
    execution.finishedAt = now;
    execution.durationMs = new Date(now).getTime() - new Date(execution.createdAt).getTime();
  }

  private recordFailure(execution: QueryExecutionRecord, error: string, isTimeout: boolean): void {
    execution.attempts += 1;
    execution.error = error;
    execution.logs.push({
      at: new Date().toISOString(),
      event: isTimeout ? 'TIMEOUT' : 'FAILED',
      detail: error,
    });

    if (execution.attempts < execution.maxAttempts) {
      execution.status = 'QUEUED';
      execution.dispatchedAt = null;
      execution.scheduledAt = new Date(
        Date.now() + computeBackoffDelayMs(execution.attempts)
      ).toISOString();
      execution.logs.push({ at: new Date().toISOString(), event: 'RETRY_SCHEDULED' });
    } else {
      this.finish(execution, isTimeout ? 'TIMEOUT' : 'FAILED');
    }
  }

  /** Lazily evaluated on every read/claim — no background scheduler, matching every sibling module's convention. */
  private evaluateTimeout(execution: QueryExecutionRecord): QueryExecutionRecord {
    if (TERMINAL_EXECUTION_STATUSES.includes(execution.status)) return execution;
    if (execution.status === 'QUEUED' || !execution.dispatchedAt) return execution; // clock only runs once actually dispatched

    const elapsed = Date.now() - new Date(execution.dispatchedAt).getTime();
    if (elapsed > execution.timeoutMs) {
      this.recordFailure(
        execution,
        'Execution timed out waiting for a result from the Runtime',
        true
      );
    }
    return execution;
  }

  claimExecutionsForRuntime(runtimeId: string): QueryExecutionRecord[] {
    const now = Date.now();
    const claimable = this.executions
      .map((e) => this.evaluateTimeout(e))
      .filter(
        (e) =>
          e.runtimeId === runtimeId &&
          e.status === 'QUEUED' &&
          new Date(e.scheduledAt).getTime() <= now
      );

    const dispatchedAt = new Date().toISOString();
    for (const execution of claimable) {
      execution.status = 'DISPATCHED';
      execution.dispatchedAt = dispatchedAt;
      execution.logs.push({ at: dispatchedAt, event: 'DISPATCHED' });
    }
    return claimable;
  }

  async reportResult(input: ReportExecutionResultInput): Promise<ReportResultResult> {
    const execution = this.getById(input.executionId);
    if (!execution) return { ok: false, error: 'EXECUTION_NOT_FOUND' };
    if (execution.runtimeId !== input.runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    if (TERMINAL_EXECUTION_STATUSES.includes(execution.status)) {
      // Covers both duplicate reports and a Runtime reporting late after cancellation — idempotent, never resurrects a terminal execution.
      return { ok: true, execution, alreadyReported: true };
    }

    if (!input.success) {
      const isTransient = input.transient !== false;
      if (isTransient) {
        this.recordFailure(execution, input.error ?? 'Runtime reported a transient failure', false);
      } else {
        execution.attempts += 1;
        execution.error = input.error ?? 'Runtime reported a permanent failure';
        execution.logs.push({
          at: new Date().toISOString(),
          event: 'FAILED',
          detail: execution.error,
        });
        this.finish(execution, 'FAILED');
      }
      return { ok: true, execution, alreadyReported: false };
    }

    const processed = processResultRows(input.rows ?? [], input.columns);
    execution.storedRows = processed.rows;
    execution.storedColumns = processed.columns;
    execution.totalRows = input.totalRows ?? processed.rows.length;
    execution.attempts += 1;
    execution.logs.push({
      at: new Date().toISOString(),
      event: 'COMPLETED',
      detail: `${execution.totalRows} row(s)${processed.truncated ? ' (truncated in storage)' : ''}`,
    });
    this.finish(execution, 'COMPLETED');
    return { ok: true, execution, alreadyReported: false };
  }

  cancelExecution(id: string, organizationId: string): CancelExecutionResult {
    const execution = this.getById(id);
    if (!execution) return { ok: false, error: 'EXECUTION_NOT_FOUND' };
    if (execution.organizationId !== organizationId)
      return { ok: false, error: 'EXECUTION_ORGANIZATION_MISMATCH' };
    if (TERMINAL_EXECUTION_STATUSES.includes(execution.status)) {
      return { ok: false, error: 'EXECUTION_ALREADY_TERMINAL' };
    }
    execution.logs.push({ at: new Date().toISOString(), event: 'CANCEL_REQUESTED' });
    this.finish(execution, 'CANCELLED');
    return { ok: true, execution };
  }

  getById(id: string): QueryExecutionRecord | undefined {
    const execution = this.executions.find((e) => e.id === id);
    return execution ? this.evaluateTimeout(execution) : undefined;
  }

  getResultPage(
    execution: QueryExecutionRecord,
    page: number,
    pageSize: number
  ): QueryExecutionResult | null {
    if (!execution.storedRows || !execution.storedColumns || execution.totalRows === null)
      return null;
    return paginateResult(
      execution.storedRows,
      execution.storedColumns,
      execution.totalRows,
      page,
      pageSize
    );
  }

  history(
    organizationId: string,
    limit = 50,
    offset = 0
  ): { total: number; executions: QueryExecutionRecord[] } {
    const forOrg = this.executions
      .map((e) => this.evaluateTimeout(e))
      .filter((e) => e.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { total: forOrg.length, executions: forOrg.slice(offset, offset + limit) };
  }

  toDTO(execution: QueryExecutionRecord): QueryExecutionDTO {
    return {
      id: execution.id,
      organizationId: execution.organizationId,
      runtimeId: execution.runtimeId,
      profileId: execution.profileId,
      generatedQueryId: execution.generatedQueryId,
      queryPlanId: execution.queryPlanId,
      canonicalVersion: execution.canonicalVersion,
      dialect: execution.dialect,
      status: execution.status,
      attempts: execution.attempts,
      maxAttempts: execution.maxAttempts,
      error: execution.error,
      totalRows: execution.totalRows,
      requestedBy: execution.requestedBy,
      createdAt: execution.createdAt,
      dispatchedAt: execution.dispatchedAt,
      finishedAt: execution.finishedAt,
      durationMs: execution.durationMs,
    };
  }
}

export const queryExecutionStore = QueryExecutionStore.getInstance();
