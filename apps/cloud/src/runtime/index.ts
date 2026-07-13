/**
 * @seltriva/cloud — runtime
 * Cloud platform runtime: lifecycle, process management, and shutdown coordination.
 */

export type CloudRuntimeStatus =
  | 'initializing'
  | 'starting'
  | 'running'
  | 'degraded'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface ICloudRuntime {
  readonly status: CloudRuntimeStatus;
  readonly startedAt: Date | null;
  readonly version: string;
  readonly uptimeMs: number;

  start(): Promise<void>;
  stop(graceful?: boolean): Promise<void>;
  restart(): Promise<void>;
  onShutdown(handler: () => Promise<void>): void;
  getProcessMetrics(): ProcessMetrics;
}

export interface ProcessMetrics {
  readonly pid: number;
  readonly uptime: number;
  readonly memoryUsage: NodeJS.MemoryUsage;
  readonly cpuUsage: NodeJS.CpuUsage;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
}

export interface CloudBootstrapResult {
  readonly status: 'success' | 'failed';
  readonly version: string;
  readonly startedAt: Date;
  readonly bootstrapDurationMs: number;
  readonly phases: CloudBootstrapPhaseResult[];
}

export interface CloudBootstrapPhaseResult {
  readonly phase: CloudBootstrapPhase;
  readonly status: 'completed' | 'failed' | 'skipped';
  readonly durationMs: number;
  readonly tasks: CloudBootstrapTaskResult[];
}

export interface CloudBootstrapTaskResult {
  readonly taskId: string;
  readonly status: 'completed' | 'failed' | 'skipped';
  readonly durationMs: number;
  readonly error?: string;
}

export type CloudBootstrapPhase =
  | 'configuration'
  | 'database'
  | 'services'
  | 'scheduler'
  | 'health-checks'
  | 'ready';

export const CLOUD_BOOTSTRAP_PHASE_ORDER: CloudBootstrapPhase[] = [
  'configuration',
  'database',
  'services',
  'scheduler',
  'health-checks',
  'ready',
];

export const CLOUD_BOOTSTRAP_TASK_IDS = {
  // configuration
  LOAD_ENV: 'task-load-env',
  VALIDATE_ENV: 'task-validate-env',
  INIT_LOGGER: 'task-init-logger',
  INIT_TRACER: 'task-init-tracer',

  // database
  INIT_PRISMA: 'task-init-prisma',
  PING_DATABASE: 'task-ping-database',
  RUN_MIGRATIONS: 'task-run-migrations',

  // services
  INIT_SUPABASE: 'task-init-supabase',
  INIT_REDIS: 'task-init-redis',
  INIT_STORAGE: 'task-init-storage',
  INIT_EMAIL: 'task-init-email',
  INIT_QUEUE: 'task-init-queue',
  WIRE_SERVICES: 'task-wire-services',

  // scheduler
  REGISTER_JOBS: 'task-register-jobs',
  START_SCHEDULER: 'task-start-scheduler',

  // health
  REGISTER_CHECKS: 'task-register-health-checks',

  // ready
  EMIT_READY: 'task-emit-ready',
} as const;

export const CLOUD_VERSION = '0.1.0';
export const CLOUD_CODENAME = 'Atlas';
