import { randomUUID } from 'node:crypto';
import { controlPlaneStore } from '../control-plane/control-plane-store.js';
import type {
  RuntimeMetric,
  RuntimeHealthSnapshot,
  HealthCheckStatus,
  RuntimeCommand,
  RuntimeCommandType,
  RuntimeLog,
  LogLevel,
  RuntimeAlert,
  AlertType,
  AlertSeverity,
  FleetNotification,
  NotificationChannel,
  DeploymentJob,
  DeploymentMode,
  DeploymentStrategy,
  DeploymentTask,
} from './types.js';
import { deliverNotification } from './notification-engine.js';

const HIGH_CPU_THRESHOLD = 85;
const HIGH_MEM_THRESHOLD = 85;
const TOKEN_EXPIRING_WINDOW_DAYS = 30;
const SCHEDULED_JOB_TICK_MS = 5_000;

/** Zero-Downtime Deployment task sequence per strategy (Sprint 47 / ATLAS FORTRESS). */
function stepsForStrategy(strategy: DeploymentStrategy): string[] {
  switch (strategy) {
    case 'ROLLING':
      return [
        'Validate target environment',
        'Roll batch 1/3',
        'Health check batch 1/3',
        'Roll batch 2/3',
        'Health check batch 2/3',
        'Roll batch 3/3',
        'Health check batch 3/3',
        'Activate',
      ];
    case 'BLUE_GREEN':
      return [
        'Validate target environment',
        'Provision green environment',
        'Deploy version to green',
        'Health check green',
        'Switch traffic to green',
        'Decommission blue environment',
      ];
    case 'CANARY':
      return [
        'Validate target environment',
        'Deploy canary (10%)',
        'Monitor canary metrics',
        'Promote canary to 50%',
        'Monitor at 50%',
        'Promote to 100%',
      ];
  }
}

interface ConnectorOperationLog {
  id: string;
  organizationId: string;
  pluginId: string;
  action: string;
  message: string;
  createdAt: string;
}

let _instance: FleetOpsStore | null = null;

export class FleetOpsStore {
  private metrics: RuntimeMetric[] = [];
  private healthSnapshots: RuntimeHealthSnapshot[] = [];
  private commands: RuntimeCommand[] = [];
  private logs: RuntimeLog[] = [];
  private alerts: RuntimeAlert[] = [];
  private notifications: FleetNotification[] = [];
  private deploymentJobs: DeploymentJob[] = [];
  private deploymentTasks: DeploymentTask[] = [];
  private connectorLogs: ConnectorOperationLog[] = [];

  private constructor() {
    this.seed();
    // Simulated scheduler tick — promotes SCHEDULED deployment jobs whose
    // scheduledAt has arrived. No real background-job infra in this sandbox.
    setInterval(() => this.tickScheduledJobs(), SCHEDULED_JOB_TICK_MS).unref();
  }

  static getInstance(): FleetOpsStore {
    if (!_instance) _instance = new FleetOpsStore();
    return _instance;
  }

  // ─── Fleet dashboard / metrics ──────────────────────────────────────────

  getLatestMetric(runtimeId: string): RuntimeMetric | undefined {
    return [...this.metrics].reverse().find((m) => m.runtimeId === runtimeId);
  }

  getMetricHistory(runtimeId: string, limit = 50): RuntimeMetric[] {
    return this.metrics
      .filter((m) => m.runtimeId === runtimeId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .slice(0, limit);
  }

  getFleetOverview(): {
    runtimesTotal: number;
    runtimesOnline: number;
    runtimesOffline: number;
    runtimesDegraded: number;
    avgCpuPct: number;
    avgMemPct: number;
    avgDiskPct: number;
    avgLatencyMs: number;
    alertsActive: number;
    alertsCritical: number;
  } {
    const runtimes = controlPlaneStore.listRuntimes();
    const latestMetrics = runtimes
      .map((r) => this.getLatestMetric(r.id))
      .filter((m): m is RuntimeMetric => Boolean(m));
    const avg = (fn: (m: RuntimeMetric) => number): number =>
      latestMetrics.length === 0
        ? 0
        : Math.round(latestMetrics.reduce((s, m) => s + fn(m), 0) / latestMetrics.length);

    this.evaluateAlerts();
    const activeAlerts = this.alerts.filter((a) => a.status === 'ACTIVE');

    return {
      runtimesTotal: runtimes.length,
      runtimesOnline: runtimes.filter((r) => r.status === 'ONLINE').length,
      runtimesOffline: runtimes.filter((r) => r.status === 'OFFLINE' || r.status === 'UNRESPONSIVE')
        .length,
      runtimesDegraded: runtimes.filter((r) => r.status === 'DEGRADED').length,
      avgCpuPct: avg((m) => m.cpuPct),
      avgMemPct: avg((m) => m.memPct),
      avgDiskPct: avg((m) => m.diskPct),
      avgLatencyMs: avg((m) => m.latencyMs),
      alertsActive: activeAlerts.length,
      alertsCritical: activeAlerts.filter((a) => a.severity === 'CRITICAL').length,
    };
  }

  getRuntimeStatusFeed(): Array<{
    runtimeId: string;
    name: string;
    status: string;
    metric?: RuntimeMetric;
  }> {
    return controlPlaneStore.listRuntimes().map((r) => ({
      runtimeId: r.id,
      name: r.name,
      status: r.status,
      metric: this.getLatestMetric(r.id),
    }));
  }

  getRuntimeDetail(runtimeId: string): {
    runtime: ReturnType<typeof controlPlaneStore.getRuntime>;
    metrics: RuntimeMetric[];
    healthSnapshots: RuntimeHealthSnapshot[];
    logs: RuntimeLog[];
    commands: RuntimeCommand[];
  } | null {
    const runtime = controlPlaneStore.getRuntime(runtimeId);
    if (!runtime) return null;
    return {
      runtime,
      metrics: this.getMetricHistory(runtimeId, 20),
      healthSnapshots: this.healthSnapshots
        .filter((h) => h.runtimeId === runtimeId)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .slice(0, 10),
      logs: this.logs
        .filter((l) => l.runtimeId === runtimeId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50),
      commands: this.commands
        .filter((c) => c.runtimeId === runtimeId)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
        .slice(0, 20),
    };
  }

  // ─── Heartbeat ingestion ────────────────────────────────────────────────

  /**
   * Records a metric + health snapshot without side effects on runtime
   * status — used both by the real heartbeat endpoint (via recordHeartbeat,
   * which additionally clears OFFLINE/UNRESPONSIVE) and by seeding, which
   * must NOT silently online a deliberately-offline seeded runtime.
   */
  private captureMetric(
    runtimeId: string,
    input: { cpuPct: number; memPct: number; diskPct: number; latencyMs: number }
  ): RuntimeMetric | null {
    const runtime = controlPlaneStore.getRuntime(runtimeId);
    if (!runtime) return null;

    const metric: RuntimeMetric = {
      id: randomUUID(),
      runtimeId,
      status: runtime.status,
      cpuPct: input.cpuPct,
      memPct: input.memPct,
      diskPct: input.diskPct,
      latencyMs: input.latencyMs,
      version: runtime.version,
      recordedAt: new Date().toISOString(),
    };
    this.metrics.push(metric);

    const status: HealthCheckStatus =
      input.cpuPct > 95 || input.memPct > 95
        ? 'FAIL'
        : input.cpuPct > HIGH_CPU_THRESHOLD
          ? 'WARN'
          : 'PASS';
    this.healthSnapshots.push({
      id: randomUUID(),
      runtimeId,
      status,
      checks: [
        {
          name: 'cpu',
          status: input.cpuPct > HIGH_CPU_THRESHOLD ? 'WARN' : 'PASS',
          message: `${input.cpuPct}%`,
        },
        {
          name: 'memory',
          status: input.memPct > HIGH_MEM_THRESHOLD ? 'WARN' : 'PASS',
          message: `${input.memPct}%`,
        },
        {
          name: 'disk',
          status: input.diskPct > 90 ? 'WARN' : 'PASS',
          message: `${input.diskPct}%`,
        },
      ],
      recordedAt: metric.recordedAt,
    });

    return metric;
  }

  /** Real heartbeat ingestion — a live check-in always implies the runtime is reachable. */
  recordHeartbeat(
    runtimeId: string,
    input: { cpuPct: number; memPct: number; diskPct: number; latencyMs: number }
  ): RuntimeMetric | null {
    const runtime = controlPlaneStore.getRuntime(runtimeId);
    if (!runtime) return null;

    const metric = this.captureMetric(runtimeId, input);
    if (!metric) return null;

    runtime.lastSeenAt = metric.recordedAt;
    runtime.updatedAt = metric.recordedAt;
    if (runtime.status === 'OFFLINE' || runtime.status === 'UNRESPONSIVE')
      runtime.status = 'ONLINE';

    this.evaluateAlerts();
    return metric;
  }

  // ─── Remote actions (runtime commands) ─────────────────────────────────

  issueCommand(
    runtimeId: string,
    type: RuntimeCommandType,
    requestedBy?: string
  ): RuntimeCommand | null {
    const runtime = controlPlaneStore.getRuntime(runtimeId);
    if (!runtime) return null;

    const now = new Date().toISOString();
    const command: RuntimeCommand = {
      id: randomUUID(),
      runtimeId,
      type,
      status: 'RUNNING',
      requestedBy,
      issuedAt: now,
    };
    this.commands.push(command);

    // Simulated execution — resolves synchronously, matching the pattern used
    // for Deployments in control-plane-store.ts (no real agent to drive this).
    switch (type) {
      case 'RESTART':
        controlPlaneStore.restartRuntime(runtimeId);
        break;
      case 'UPDATE':
      case 'REINSTALL':
        runtime.status = 'ONLINE';
        runtime.updatedAt = new Date().toISOString();
        break;
      case 'SYNC_NOW':
      case 'FORCE_HEARTBEAT':
        this.recordHeartbeat(runtimeId, {
          cpuPct: Math.round(20 + Math.random() * 30),
          memPct: Math.round(30 + Math.random() * 30),
          diskPct: Math.round(20 + Math.random() * 20),
          latencyMs: Math.round(5 + Math.random() * 20),
        });
        break;
      case 'CLEAR_CACHE':
        break;
      case 'DISABLE':
        runtime.status = 'RETIRED';
        runtime.updatedAt = new Date().toISOString();
        break;
      case 'ENABLE':
        runtime.status = 'ONLINE';
        runtime.lastSeenAt = new Date().toISOString();
        runtime.updatedAt = runtime.lastSeenAt;
        break;
    }

    command.status = 'SUCCEEDED';
    command.completedAt = new Date().toISOString();

    this.addLog(runtimeId, 'INFO', `Command ${type} executed successfully`, 'command-runner');
    return command;
  }

  // ─── Logs ───────────────────────────────────────────────────────────────

  addLog(runtimeId: string, level: LogLevel, message: string, source?: string): RuntimeLog {
    const log: RuntimeLog = {
      id: randomUUID(),
      runtimeId,
      level,
      message,
      source,
      createdAt: new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  getLogs(runtimeId: string, limit = 50): RuntimeLog[] {
    return this.logs
      .filter((l) => l.runtimeId === runtimeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  // ─── Connector operations ───────────────────────────────────────────────

  installConnector(
    organizationId: string,
    pluginId: string,
    version: string
  ): ReturnType<typeof controlPlaneStore.installOrganizationConnector> {
    const record = controlPlaneStore.installOrganizationConnector(
      organizationId,
      pluginId,
      version
    );
    this.logConnectorOp(organizationId, pluginId, 'INSTALL', `Installed version ${version}`);
    return record;
  }

  updateConnector(
    organizationId: string,
    pluginId: string,
    version: string
  ): ReturnType<typeof controlPlaneStore.installOrganizationConnector> {
    const record = controlPlaneStore.installOrganizationConnector(
      organizationId,
      pluginId,
      version
    );
    this.logConnectorOp(organizationId, pluginId, 'UPDATE', `Updated to version ${version}`);
    return record;
  }

  removeConnector(organizationId: string, pluginId: string): boolean {
    const ok = controlPlaneStore.removeOrganizationConnector(organizationId, pluginId);
    if (ok) this.logConnectorOp(organizationId, pluginId, 'REMOVE', 'Connector removed');
    return ok;
  }

  restartConnector(
    organizationId: string,
    pluginId: string
  ): ReturnType<typeof controlPlaneStore.getOrganizationConnector> | null {
    const existing = controlPlaneStore.getOrganizationConnector(organizationId, pluginId);
    if (!existing) return null;
    controlPlaneStore.setOrganizationConnectorEnabled(organizationId, pluginId, false);
    const restarted = controlPlaneStore.setOrganizationConnectorEnabled(
      organizationId,
      pluginId,
      true
    );
    this.logConnectorOp(organizationId, pluginId, 'RESTART', 'Connector restarted');
    return restarted;
  }

  getConnectorLogs(organizationId: string, pluginId: string): ConnectorOperationLog[] {
    return this.connectorLogs
      .filter((l) => l.organizationId === organizationId && l.pluginId === pluginId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private logConnectorOp(
    organizationId: string,
    pluginId: string,
    action: string,
    message: string
  ): void {
    this.connectorLogs.push({
      id: randomUUID(),
      organizationId,
      pluginId,
      action,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────

  private upsertAlert(input: {
    organizationId: string;
    runtimeId?: string;
    pluginId?: string;
    deploymentId?: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
  }): void {
    const existing = this.alerts.find(
      (a) =>
        a.status === 'ACTIVE' &&
        a.type === input.type &&
        a.runtimeId === input.runtimeId &&
        a.pluginId === input.pluginId &&
        a.deploymentId === input.deploymentId
    );
    if (existing) return;

    const alert: RuntimeAlert = {
      id: randomUUID(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.alerts.push(alert);
    void this.notifyForAlert(alert);
  }

  evaluateAlerts(): void {
    const runtimes = controlPlaneStore.listRuntimes();
    for (const runtime of runtimes) {
      if (runtime.status === 'OFFLINE' || runtime.status === 'UNRESPONSIVE') {
        this.upsertAlert({
          organizationId: runtime.organizationId,
          runtimeId: runtime.id,
          type: 'RUNTIME_OFFLINE',
          severity: 'CRITICAL',
          message: `Runtime "${runtime.name}" is ${runtime.status.toLowerCase()}`,
        });
      }
      const metric = this.getLatestMetric(runtime.id);
      if (metric && metric.cpuPct > HIGH_CPU_THRESHOLD) {
        this.upsertAlert({
          organizationId: runtime.organizationId,
          runtimeId: runtime.id,
          type: 'HIGH_CPU',
          severity: metric.cpuPct > 95 ? 'CRITICAL' : 'WARNING',
          message: `Runtime "${runtime.name}" CPU at ${metric.cpuPct}%`,
        });
      }
      if (metric && metric.memPct > HIGH_MEM_THRESHOLD) {
        this.upsertAlert({
          organizationId: runtime.organizationId,
          runtimeId: runtime.id,
          type: 'HIGH_MEMORY',
          severity: metric.memPct > 95 ? 'CRITICAL' : 'WARNING',
          message: `Runtime "${runtime.name}" memory at ${metric.memPct}%`,
        });
      }
    }

    for (const deployment of controlPlaneStore.listDeployments({ status: 'FAILED' })) {
      this.upsertAlert({
        organizationId: deployment.organizationId,
        deploymentId: deployment.id,
        pluginId: deployment.pluginId,
        type: 'DEPLOY_FAILED',
        severity: 'CRITICAL',
        message: `Deployment ${deployment.id} failed: ${deployment.error ?? 'unknown error'}`,
      });
    }
  }

  listAlerts(
    filters: { organizationId?: string; severity?: string; status?: string; type?: string } = {}
  ): RuntimeAlert[] {
    this.evaluateAlerts();
    let list = [...this.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.organizationId)
      list = list.filter((a) => a.organizationId === filters.organizationId);
    if (filters.severity) list = list.filter((a) => a.severity === filters.severity);
    if (filters.status) list = list.filter((a) => a.status === filters.status);
    if (filters.type) list = list.filter((a) => a.type === filters.type);
    return list;
  }

  acknowledgeAlert(id: string): RuntimeAlert | null {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date().toISOString();
    return alert;
  }

  resolveAlert(id: string): RuntimeAlert | null {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    return alert;
  }

  // ─── Notifications ──────────────────────────────────────────────────────

  private async notifyForAlert(alert: RuntimeAlert): Promise<void> {
    const channels: NotificationChannel[] =
      alert.severity === 'CRITICAL' ? ['WEBSOCKET', 'EMAIL'] : ['WEBSOCKET'];
    for (const channel of channels) {
      await this.sendNotification({
        channel,
        target: channel === 'EMAIL' ? 'ops-team@atlasconnect.com.br' : 'broadcast',
        subject: `[${alert.severity}] ${alert.type}`,
        body: alert.message,
        relatedAlertId: alert.id,
      });
    }
  }

  async sendNotification(input: {
    channel: NotificationChannel;
    target: string;
    subject?: string;
    body: string;
    relatedAlertId?: string;
  }): Promise<FleetNotification> {
    const record: FleetNotification = {
      id: randomUUID(),
      channel: input.channel,
      target: input.target,
      subject: input.subject,
      body: input.body,
      relatedAlertId: input.relatedAlertId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(record);

    const result = await deliverNotification(input);
    record.status = result.status;
    record.error = result.error;
    if (result.status === 'SENT') record.sentAt = new Date().toISOString();
    return record;
  }

  listNotifications(filters: { channel?: string; status?: string } = {}): FleetNotification[] {
    let list = [...this.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.channel) list = list.filter((n) => n.channel === filters.channel);
    if (filters.status) list = list.filter((n) => n.status === filters.status);
    return list;
  }

  // ─── Deployment jobs (approval / scheduling) ────────────────────────────

  /** Chaos-testing hook (Sprint 47): the job's next execution fails at the named step and auto-rolls-back. */
  private failureInjections = new Map<string, string>();

  injectDeploymentFailure(jobId: string, atStep: string): void {
    this.failureInjections.set(jobId, atStep);
  }

  /** Runs the strategy's task sequence, stopping and marking FAILED at an injected failure step, if any. */
  private runTasks(job: DeploymentJob): {
    tasks: DeploymentTask[];
    failedTask: DeploymentTask | null;
  } {
    const steps = stepsForStrategy(job.strategy);
    const failAt = this.failureInjections.get(job.id);
    this.failureInjections.delete(job.id);

    const tasks: DeploymentTask[] = [];
    let failedTask: DeploymentTask | null = null;

    for (let i = 0; i < steps.length; i++) {
      const name = steps[i];
      if (failedTask) {
        // A prior step already failed — remaining steps never run.
        const pendingTask: DeploymentTask = {
          id: randomUUID(),
          jobId: job.id,
          name,
          status: 'PENDING',
          order: i,
        };
        this.deploymentTasks.push(pendingTask);
        tasks.push(pendingTask);
        continue;
      }
      const now = new Date().toISOString();
      const willFail = name === failAt;
      const task: DeploymentTask = {
        id: randomUUID(),
        jobId: job.id,
        name,
        status: willFail ? 'FAILED' : 'SUCCEEDED',
        order: i,
        startedAt: now,
        completedAt: now,
      };
      this.deploymentTasks.push(task);
      tasks.push(task);
      if (willFail) failedTask = task;
    }

    return { tasks, failedTask };
  }

  /** Appends real rollback tasks (halt / revert / restore traffic) after a failed step. */
  private runRollbackTasks(job: DeploymentJob, failedTask: DeploymentTask): void {
    const steps = [
      'Halt rollout',
      `Revert to previous version (pre-${job.pluginVersionId})`,
      'Restore traffic to last known-good targets',
    ];
    steps.forEach((name, i) => {
      const now = new Date().toISOString();
      this.deploymentTasks.push({
        id: randomUUID(),
        jobId: job.id,
        name,
        status: 'SUCCEEDED',
        order: failedTask.order + 1 + i,
        startedAt: now,
        completedAt: now,
      });
    });
  }

  private executeJob(job: DeploymentJob): void {
    job.status = 'IN_PROGRESS';
    job.startedAt = new Date().toISOString();

    const result = controlPlaneStore.createDeployment({
      organizationId: job.organizationId,
      environmentId: job.environmentId,
      pluginId: job.pluginId,
      pluginVersionId: job.pluginVersionId,
      triggeredBy: job.requestedBy,
    });

    if (typeof result === 'string') {
      job.status = 'FAILED';
      job.error = result;
      job.completedAt = new Date().toISOString();
      return;
    }

    const { failedTask } = this.runTasks(job);

    if (failedTask) {
      job.error = `Deployment failed at step "${failedTask.name}" (${job.strategy})`;
      if (job.autoRollback) {
        this.runRollbackTasks(job, failedTask);
        job.status = 'ROLLED_BACK';
        job.rollbackReason = job.error;
      } else {
        job.status = 'FAILED';
      }
    } else {
      job.status = 'SUCCEEDED';
    }
    job.completedAt = new Date().toISOString();
  }

  createDeploymentJob(input: {
    organizationId: string;
    environmentId: string;
    pluginId: string;
    pluginVersionId: string;
    mode: DeploymentMode;
    strategy?: DeploymentStrategy;
    autoRollback?: boolean;
    scheduledAt?: string;
    requestedBy?: string;
  }): DeploymentJob {
    const now = new Date().toISOString();
    const job: DeploymentJob = {
      id: randomUUID(),
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      pluginId: input.pluginId,
      pluginVersionId: input.pluginVersionId,
      mode: input.mode,
      strategy: input.strategy ?? 'ROLLING',
      autoRollback: input.autoRollback ?? true,
      status:
        input.mode === 'MANUAL'
          ? 'PENDING_APPROVAL'
          : input.mode === 'SCHEDULED'
            ? 'SCHEDULED'
            : 'APPROVED',
      scheduledAt: input.scheduledAt,
      requestedBy: input.requestedBy,
      createdAt: now,
    };
    this.deploymentJobs.push(job);

    if (job.mode === 'AUTOMATIC') this.executeJob(job);
    return job;
  }

  listDeploymentJobs(
    filters: { organizationId?: string; status?: string; mode?: string } = {}
  ): DeploymentJob[] {
    let list = [...this.deploymentJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.organizationId)
      list = list.filter((j) => j.organizationId === filters.organizationId);
    if (filters.status) list = list.filter((j) => j.status === filters.status);
    if (filters.mode) list = list.filter((j) => j.mode === filters.mode);
    return list;
  }

  getDeploymentJob(id: string): DeploymentJob | undefined {
    return this.deploymentJobs.find((j) => j.id === id);
  }

  getDeploymentTasks(jobId: string): DeploymentTask[] {
    return this.deploymentTasks.filter((t) => t.jobId === jobId).sort((a, b) => a.order - b.order);
  }

  approveDeploymentJob(
    id: string,
    approvedBy?: string
  ): DeploymentJob | 'NOT_FOUND' | 'NOT_APPROVABLE' {
    const job = this.getDeploymentJob(id);
    if (!job) return 'NOT_FOUND';
    if (job.status !== 'PENDING_APPROVAL') return 'NOT_APPROVABLE';
    job.approvedBy = approvedBy;
    this.executeJob(job);
    return job;
  }

  rejectDeploymentJob(id: string): DeploymentJob | 'NOT_FOUND' | 'NOT_REJECTABLE' {
    const job = this.getDeploymentJob(id);
    if (!job) return 'NOT_FOUND';
    if (job.status !== 'PENDING_APPROVAL' && job.status !== 'SCHEDULED') return 'NOT_REJECTABLE';
    job.status = 'REJECTED';
    job.completedAt = new Date().toISOString();
    return job;
  }

  rollbackDeploymentJob(id: string): DeploymentJob | 'NOT_FOUND' | 'NOT_ROLLBACKABLE' {
    const job = this.getDeploymentJob(id);
    if (!job) return 'NOT_FOUND';
    if (job.status !== 'SUCCEEDED') return 'NOT_ROLLBACKABLE';
    job.status = 'ROLLED_BACK';
    job.completedAt = new Date().toISOString();
    return job;
  }

  /** Promotes SCHEDULED jobs whose scheduledAt has arrived. */
  private tickScheduledJobs(): void {
    const now = Date.now();
    for (const job of this.deploymentJobs) {
      if (
        job.status === 'SCHEDULED' &&
        job.scheduledAt &&
        new Date(job.scheduledAt).getTime() <= now
      ) {
        this.executeJob(job);
      }
    }
  }

  // ─── Seed data ──────────────────────────────────────────────────────────

  private seed(): void {
    const runtimes = controlPlaneStore.listRuntimes();
    for (const runtime of runtimes) {
      const online = runtime.status === 'ONLINE';
      // captureMetric (not recordHeartbeat) — seeding must preserve the
      // deliberately-varied statuses from control-plane-store's own seed,
      // not silently online every runtime via the heartbeat side effect.
      this.captureMetric(runtime.id, {
        cpuPct: online ? Math.round(15 + Math.random() * 40) : 0,
        memPct: online ? Math.round(25 + Math.random() * 40) : 0,
        diskPct: Math.round(20 + Math.random() * 30),
        latencyMs: online ? Math.round(4 + Math.random() * 20) : 0,
      });
      this.addLog(runtime.id, 'INFO', `Runtime "${runtime.name}" registered`, 'system');
    }

    // One deliberately hot runtime for a realistic HIGH_CPU alert demo.
    const hot = runtimes.find((r) => r.status === 'ONLINE');
    if (hot) {
      this.captureMetric(hot.id, { cpuPct: 92, memPct: 88, diskPct: 40, latencyMs: 12 });
    }

    this.evaluateAlerts();
  }
}

export const fleetOpsStore = FleetOpsStore.getInstance();
