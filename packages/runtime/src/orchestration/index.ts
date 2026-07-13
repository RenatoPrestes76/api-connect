/**
 * @seltriva/runtime/orchestration
 * Orchestration — coordinated multi-module operation management
 *
 * While the lifecycle manager handles module state, the orchestrator
 * handles complex multi-step operations that span multiple modules:
 *   - Coordinated startup sequences
 *   - Multi-module rollback on failure
 *   - Dependency-aware parallel execution
 *   - Long-running saga orchestration
 *   - Distributed operation coordination
 */

import type { RuntimeResult, ModuleId, CorrelationId, Priority, Disposable } from '../kernel/index';

// ─── Orchestrator ─────────────────────────────────────────────────────────

export interface Orchestrator {
  /**
   * Execute an orchestration plan
   */
  execute(plan: OrchestrationPlan): Promise<RuntimeResult<OrchestrationResult>>;

  /**
   * Execute a predefined workflow
   */
  executeWorkflow(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<RuntimeResult<OrchestrationResult>>;

  /**
   * Cancel an in-progress orchestration
   */
  cancel(orchestrationId: string, reason?: string): Promise<RuntimeResult<void>>;

  /**
   * Get the status of an in-progress orchestration
   */
  getStatus(orchestrationId: string): OrchestrationStatus | null;

  /**
   * List all running orchestrations
   */
  getRunning(): OrchestrationStatus[];

  /**
   * Register a workflow template
   */
  registerWorkflow(workflow: WorkflowDefinition): void;

  /**
   * Get a registered workflow
   */
  getWorkflow(workflowId: string): WorkflowDefinition | null;

  /**
   * Subscribe to orchestration events
   */
  onEvent(handler: OrchestrationEventHandler): Disposable;
}

// ─── Orchestration Plan ───────────────────────────────────────────────────

export interface OrchestrationPlan {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly steps: OrchestrationStep[];
  readonly priority?: Priority;
  readonly timeoutMs?: number;
  readonly compensationSteps?: OrchestrationStep[];
  readonly metadata?: Record<string, unknown>;
}

// ─── Orchestration Step ───────────────────────────────────────────────────

export interface OrchestrationStep {
  readonly id: string;
  readonly name: string;
  readonly moduleId: ModuleId;
  readonly action: StepAction;
  readonly dependsOn?: string[];
  readonly runInParallel?: boolean;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly compensation?: StepAction;
  readonly condition?: StepCondition;
}

export type StepAction =
  | CommandStepAction
  | EventStepAction
  | ServiceCallStepAction
  | WaitStepAction
  | BranchStepAction;

export interface CommandStepAction {
  readonly kind: 'command';
  readonly commandType: string;
  readonly payload: Record<string, unknown>;
}

export interface EventStepAction {
  readonly kind: 'event';
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

export interface ServiceCallStepAction {
  readonly kind: 'service-call';
  readonly serviceToken: string;
  readonly method: string;
  readonly args?: unknown[];
}

export interface WaitStepAction {
  readonly kind: 'wait';
  readonly durationMs: number;
}

export interface BranchStepAction {
  readonly kind: 'branch';
  readonly condition: StepCondition;
  readonly thenSteps: OrchestrationStep[];
  readonly elseSteps?: OrchestrationStep[];
}

export interface StepCondition {
  readonly kind: 'expression' | 'previous-step-result' | 'event-received' | 'flag-enabled';
  readonly expression?: string;
  readonly stepId?: string;
  readonly eventTopic?: string;
  readonly flagName?: string;
}

// ─── Orchestration Result ─────────────────────────────────────────────────

export interface OrchestrationResult {
  readonly orchestrationId: string;
  readonly planId: string;
  readonly status: OrchestrationCompletionStatus;
  readonly stepResults: StepResult[];
  readonly compensated: boolean;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

export type OrchestrationCompletionStatus =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed-out'
  | 'compensated';

export interface StepResult {
  readonly stepId: string;
  readonly stepName: string;
  readonly status: 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'timed-out';
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
  readonly attempt: number;
}

// ─── Orchestration Status ─────────────────────────────────────────────────

export interface OrchestrationStatus {
  readonly orchestrationId: string;
  readonly planId: string;
  readonly status: 'running' | 'paused' | 'compensating';
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly currentStepIds: string[];
  readonly startedAt: Date;
  readonly correlationId: CorrelationId;
}

// ─── Workflow Definition ──────────────────────────────────────────────────

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly plan: OrchestrationPlan;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly tags?: string[];
}

// ─── Built-in Workflows ───────────────────────────────────────────────────

export const WORKFLOW_IDS = {
  PLATFORM_STARTUP: 'workflow-platform-startup',
  PLATFORM_SHUTDOWN: 'workflow-platform-shutdown',
  PLUGIN_INSTALL: 'workflow-plugin-install',
  PLUGIN_UNINSTALL: 'workflow-plugin-uninstall',
  MODULE_HOT_RELOAD: 'workflow-module-hot-reload',
  CONNECTOR_REGISTER: 'workflow-connector-register',
  CONNECTOR_DEREGISTER: 'workflow-connector-deregister',
  SCHEMA_REGISTRATION: 'workflow-schema-registration',
  SYNC_INITIALIZATION: 'workflow-sync-initialization',
} as const;

// ─── Events ───────────────────────────────────────────────────────────────

export type OrchestrationEventKind =
  | 'plan-started'
  | 'step-started'
  | 'step-completed'
  | 'step-failed'
  | 'step-compensated'
  | 'plan-completed'
  | 'plan-failed'
  | 'plan-cancelled'
  | 'compensation-started'
  | 'compensation-completed';

export interface OrchestrationEvent {
  readonly kind: OrchestrationEventKind;
  readonly orchestrationId: string;
  readonly planId: string;
  readonly stepId?: string;
  readonly stepName?: string;
  readonly timestamp: Date;
  readonly error?: string;
}

export type OrchestrationEventHandler = (event: OrchestrationEvent) => void;

// ─── Saga (long-running orchestration) ───────────────────────────────────

export interface SagaCoordinator {
  startSaga(sagaId: string, plan: OrchestrationPlan): Promise<RuntimeResult<string>>;
  getSagaState(sagaId: string): SagaState | null;
  compensateSaga(sagaId: string, reason?: string): Promise<RuntimeResult<void>>;
}

export interface SagaState {
  readonly sagaId: string;
  readonly status: 'running' | 'succeeded' | 'compensating' | 'compensated' | 'failed';
  readonly completedSteps: string[];
  readonly compensatedSteps: string[];
  readonly startedAt: Date;
  readonly updatedAt: Date;
}
