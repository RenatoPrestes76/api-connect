export type ChaosScenarioType =
  | 'node_failure_election'
  | 'backup_restore_cycle'
  | 'load_balancer_failover'
  | 'deployment_rollback'
  | 'region_failover'
  | 'autoscaler_load_spike';

export interface ChaosScenarioResult {
  id: string;
  type: ChaosScenarioType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  passed: boolean;
  summary: string;
  details: Record<string, unknown>;
}

export interface ChaosSuiteResult {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  scenarios: ChaosScenarioResult[];
}
