import type {
  CommandResult,
  ClusterStatus,
  DeployConfig,
  RollbackConfig,
  HealthCheckResult,
  ScaleConfig,
  CtlCommand,
} from './types.js';

function result<T>(command: CtlCommand, data: T, start: number): CommandResult<T> {
  return {
    status: 'ok',
    command,
    data,
    error: null,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

function errResult<T = never>(
  command: CtlCommand,
  message: string,
  start: number
): CommandResult<T> {
  return {
    status: 'error',
    command,
    data: null,
    error: message,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export class AtlasCtl {
  private authenticated = false;
  private token: string | null = null;
  private namespace = 'atlas-production';

  login(token: string, namespace?: string): CommandResult<{ namespace: string }> {
    const t = Date.now();
    if (!token || token.length < 8) {
      return errResult('login', 'Invalid token — must be at least 8 characters', t);
    }
    this.authenticated = true;
    this.token = token;
    if (namespace) this.namespace = namespace;
    return result('login', { namespace: this.namespace }, t);
  }

  logout(): CommandResult<{ message: string }> {
    const t = Date.now();
    this.authenticated = false;
    this.token = null;
    return result('logout', { message: 'Logged out successfully' }, t);
  }

  status(): CommandResult<ClusterStatus> {
    const t = Date.now();
    if (!this.authenticated)
      return errResult('status', 'Not authenticated — run atlasctl login', t);
    return result(
      'status',
      {
        healthy: true,
        version: '1.0.0',
        stage: 'ga',
        replicas: { ready: 3, desired: 3 },
        uptime: 86400 * 7,
        region: 'sa-east-1',
      },
      t
    );
  }

  health(): CommandResult<HealthCheckResult> {
    const t = Date.now();
    if (!this.authenticated) return errResult('health', 'Not authenticated', t);
    return result(
      'health',
      {
        api: 'up',
        database: 'up',
        redis: 'up',
        agents: 38,
        overall: 'healthy',
      },
      t
    );
  }

  version(): CommandResult<{ version: string; buildNumber: number; gitSha: string }> {
    const t = Date.now();
    return result(
      'version',
      {
        version: '1.0.0',
        buildNumber: 100,
        gitSha: 'e5f6a1b2c3d4e5f6',
      },
      t
    );
  }

  deploy(config: DeployConfig): CommandResult<{ jobId: string; config: DeployConfig }> {
    const t = Date.now();
    if (!this.authenticated) return errResult('deploy', 'Not authenticated', t);
    if (!config.image || !config.tag) {
      return errResult('deploy', 'image and tag are required', t);
    }
    const validStrategies = ['rolling', 'recreate', 'canary'];
    if (!validStrategies.includes(config.strategy)) {
      return errResult('deploy', `Invalid strategy: ${config.strategy}`, t);
    }
    const jobId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return result('deploy', { jobId, config }, t);
  }

  rollback(config: RollbackConfig): CommandResult<{ jobId: string; toVersion: string }> {
    const t = Date.now();
    if (!this.authenticated) return errResult('rollback', 'Not authenticated', t);
    if (!config.toVersion) return errResult('rollback', 'toVersion is required', t);
    if (!config.reason) return errResult('rollback', 'reason is required for audit trail', t);
    const jobId = `rollback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return result('rollback', { jobId, toVersion: config.toVersion }, t);
  }

  scale(config: ScaleConfig): CommandResult<{ service: string; replicas: number }> {
    const t = Date.now();
    if (!this.authenticated) return errResult('scale', 'Not authenticated', t);
    if (config.replicas < 0 || config.replicas > 50) {
      return errResult('scale', 'replicas must be between 0 and 50', t);
    }
    const validServices = ['api', 'worker', 'agent'];
    if (!validServices.includes(config.service)) {
      return errResult('scale', `Invalid service: ${config.service}`, t);
    }
    return result('scale', { service: config.service, replicas: config.replicas }, t);
  }

  restart(service: string): CommandResult<{ service: string; restarted: boolean }> {
    const t = Date.now();
    if (!this.authenticated) return errResult('restart', 'Not authenticated', t);
    if (!service) return errResult('restart', 'service name is required', t);
    return result('restart', { service, restarted: true }, t);
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getToken(): string | null {
    return this.token;
  }

  getNamespace(): string {
    return this.namespace;
  }
}
