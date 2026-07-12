import type { HealthStatus, HealthCheckResult, HealthReport } from './types.js';

export type CheckFn = () => Promise<HealthCheckResult>;

function aggregate(results: HealthCheckResult[]): HealthStatus {
  if (results.some((r) => r.status === 'unhealthy')) return 'unhealthy';
  if (results.some((r) => r.status === 'degraded')) return 'degraded';
  return 'healthy';
}

export class HealthChecker {
  private checks = new Map<string, CheckFn>();

  register(name: string, fn: CheckFn): void {
    this.checks.set(name, fn);
  }

  deregister(name: string): void {
    this.checks.delete(name);
  }

  async run(): Promise<HealthReport> {
    const startTime = Date.now();
    const results: HealthCheckResult[] = [];

    for (const [name, fn] of this.checks) {
      const checkStart = Date.now();
      try {
        const result = await fn();
        results.push({ ...result, name, lastChecked: new Date().toISOString() });
      } catch (err) {
        results.push({
          name,
          status: 'unhealthy',
          responseTime: Date.now() - checkStart,
          message: err instanceof Error ? err.message : 'Check threw unexpectedly',
          lastChecked: new Date().toISOString(),
        });
      }
    }

    return {
      status: aggregate(results),
      version: '36.0.0',
      uptime: process.uptime(),
      checks: results,
      timestamp: new Date(startTime).toISOString(),
    };
  }

  async runOne(name: string): Promise<HealthCheckResult | null> {
    const fn = this.checks.get(name);
    if (!fn) return null;
    const start = Date.now();
    try {
      return await fn();
    } catch (err) {
      return {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: err instanceof Error ? err.message : 'unknown',
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

// Built-in check helpers
export function makeSimulatedCheck(
  name: string,
  latencyMs: number,
  status: HealthStatus,
  message?: string
): CheckFn {
  return async () => {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, latencyMs));
    return {
      name,
      status,
      responseTime: Date.now() - start,
      message,
      lastChecked: new Date().toISOString(),
    };
  };
}

export const healthChecker = new HealthChecker();
