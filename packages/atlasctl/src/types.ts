export type CommandStatus = 'ok' | 'error' | 'pending';

export interface CommandResult<T = unknown> {
  status: CommandStatus;
  command: string;
  data: T | null;
  error: string | null;
  executedAt: string;
  durationMs: number;
}

export interface ClusterStatus {
  healthy: boolean;
  version: string;
  stage: string;
  replicas: { ready: number; desired: number };
  uptime: number;
  region: string;
}

export interface DeployConfig {
  image: string;
  tag: string;
  replicas?: number;
  strategy: 'rolling' | 'recreate' | 'canary';
  namespace: string;
}

export interface RollbackConfig {
  toVersion: string;
  namespace: string;
  reason: string;
}

export interface HealthCheckResult {
  api: 'up' | 'down' | 'degraded';
  database: 'up' | 'down' | 'degraded';
  redis: 'up' | 'down' | 'degraded';
  agents: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface ScaleConfig {
  service: 'api' | 'worker' | 'agent';
  replicas: number;
  namespace: string;
}

export interface LogOptions {
  service: string;
  lines: number;
  since?: string;
  follow?: boolean;
}

export type CtlCommand =
  | 'login'
  | 'logout'
  | 'status'
  | 'deploy'
  | 'rollback'
  | 'health'
  | 'version'
  | 'scale'
  | 'logs'
  | 'restart';
