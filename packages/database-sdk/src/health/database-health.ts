export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DatabaseHealth {
  readonly connected: boolean;
  readonly latency: number;
  readonly databaseVersion: string;
  readonly activeConnections: number;
  readonly poolUsage: number;
  readonly status: HealthStatus;
}
