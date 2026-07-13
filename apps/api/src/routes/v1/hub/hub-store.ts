/**
 * In-memory hub data store — seeds realistic demo data for ATLAS HUB.
 * In production this would be backed by a real database or wired to existing
 * domain repositories. Additive Sprint 28 addition — does not touch Sprint 22-27.
 */
import { randomUUID } from 'node:crypto';

// ─── Types mirror apps/web/src/types/index.ts ────────────────────────────────

export type ConnectorStatus = 'RUNNING' | 'STOPPED' | 'ERROR' | 'STARTING' | 'STOPPING' | 'UNKNOWN';
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'STALE' | 'REGISTERING' | 'DISABLED';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type SyncResult = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RUNNING' | 'CANCELLED';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'READ_ONLY';

export interface ConnectorInstance {
  id: string;
  name: string;
  version: string;
  driver: string;
  database: string;
  host: string;
  status: ConnectorStatus;
  lastSync?: string;
  syncCount: number;
  errorCount: number;
  health: HealthStatus;
  agentId?: string;
}

export interface AgentSummary {
  id: string;
  hostname: string;
  version: string;
  os: string;
  ip: string;
  status: AgentStatus;
  lastSeen: string;
  connectors: number;
  syncCount: number;
  errorCount: number;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  driver: string;
  host: string;
  port: number;
  database: string;
  version: string;
  status: HealthStatus;
  latencyMs: number;
  poolSize: number;
  poolUsed: number;
  connectedAt: string;
  schema: string;
}

export interface SyncRecord {
  id: string;
  connectorId: string;
  connector: string;
  agentId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  result: SyncResult;
  synced: number;
  skipped: number;
  failed: number;
  entities: string[];
  errors: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  connector?: string;
  agent?: string;
  message: string;
}

export interface HubUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface HubSettings {
  sync: {
    intervalMs: number;
    retryAttempts: number;
    timeoutMs: number;
    batchSize: number;
    enableIncremental: boolean;
  };
  cache: { ttlMs: number; maxEntries: number };
  discovery: { autoRunOnConnect: boolean; confidenceMinimum: number; schemaTtlMs: number };
  notifications: {
    enableEmailAlerts: boolean;
    alertEmail: string;
    alertOnFailure: boolean;
    alertOnDegraded: boolean;
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60_000).toISOString();
}

const AGENT_IDS = [randomUUID(), randomUUID()];
const CONN_IDS = [randomUUID(), randomUUID(), randomUUID()];
const DB_IDS = [randomUUID(), randomUUID()];

class HubStore {
  connectors: Map<string, ConnectorInstance> = new Map();
  agents: Map<string, AgentSummary> = new Map();
  databases: Map<string, DatabaseConnection> = new Map();
  syncHistory: SyncRecord[] = [];
  logs: LogEntry[] = [];
  users: Map<string, HubUser> = new Map();
  settings: HubSettings;

  constructor() {
    this._seed();
    this.settings = this._defaultSettings();
  }

  private _seed() {
    // Agents
    const agentA: AgentSummary = {
      id: AGENT_IDS[0]!,
      hostname: 'prod-worker-01',
      version: '2.4.1',
      os: 'Linux x86_64',
      ip: '10.0.1.11',
      status: 'ONLINE',
      lastSeen: minutesAgo(1),
      connectors: 2,
      syncCount: 1_420,
      errorCount: 3,
    };
    const agentB: AgentSummary = {
      id: AGENT_IDS[1]!,
      hostname: 'staging-worker-02',
      version: '2.4.0',
      os: 'Linux x86_64',
      ip: '10.0.1.22',
      status: 'STALE',
      lastSeen: minutesAgo(8),
      connectors: 1,
      syncCount: 388,
      errorCount: 12,
    };
    this.agents.set(agentA.id, agentA);
    this.agents.set(agentB.id, agentB);

    // Connectors
    const conns: ConnectorInstance[] = [
      {
        id: CONN_IDS[0]!,
        name: 'ERP-Prod',
        version: '1.3.0',
        driver: 'postgresql',
        database: 'erp_prod',
        host: 'db.prod.internal',
        status: 'RUNNING',
        lastSync: minutesAgo(2),
        syncCount: 840,
        errorCount: 1,
        health: 'healthy',
        agentId: AGENT_IDS[0],
      },
      {
        id: CONN_IDS[1]!,
        name: 'CRM-Prod',
        version: '1.2.4',
        driver: 'mysql',
        database: 'crm',
        host: 'crm-db.prod.internal',
        status: 'RUNNING',
        lastSync: minutesAgo(5),
        syncCount: 580,
        errorCount: 2,
        health: 'healthy',
        agentId: AGENT_IDS[0],
      },
      {
        id: CONN_IDS[2]!,
        name: 'ERP-Staging',
        version: '1.3.0',
        driver: 'postgresql',
        database: 'erp_staging',
        host: 'db.staging.internal',
        status: 'ERROR',
        lastSync: minutesAgo(62),
        syncCount: 388,
        errorCount: 12,
        health: 'unhealthy',
        agentId: AGENT_IDS[1],
      },
    ];
    conns.forEach((c) => this.connectors.set(c.id, c));

    // Databases
    const dbs: DatabaseConnection[] = [
      {
        id: DB_IDS[0]!,
        name: 'ERP Production',
        driver: 'postgresql',
        host: 'db.prod.internal',
        port: 5432,
        database: 'erp_prod',
        version: 'PostgreSQL 15.3',
        status: 'healthy',
        latencyMs: 4,
        poolSize: 20,
        poolUsed: 8,
        connectedAt: minutesAgo(480),
        schema: 'public',
      },
      {
        id: DB_IDS[1]!,
        name: 'CRM Production',
        driver: 'mysql',
        host: 'crm-db.prod.internal',
        port: 3306,
        database: 'crm',
        version: 'MySQL 8.0.33',
        status: 'degraded',
        latencyMs: 28,
        poolSize: 10,
        poolUsed: 9,
        connectedAt: minutesAgo(480),
        schema: 'crm',
      },
    ];
    dbs.forEach((d) => this.databases.set(d.id, d));

    // Sync history (most recent first)
    const results: SyncResult[] = [
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'PARTIAL',
      'SUCCESS',
      'FAILED',
      'SUCCESS',
      'SUCCESS',
    ];
    for (let i = 0; i < 40; i++) {
      const connIdx = i % 3;
      const cid = CONN_IDS[connIdx]!;
      const cname = ['ERP-Prod', 'CRM-Prod', 'ERP-Staging'][connIdx]!;
      const result = results[i % results.length]!;
      const dur = result === 'FAILED' ? undefined : 800 + Math.floor(Math.random() * 2200);
      const started = new Date(Date.now() - (i * 18 + 2) * 60_000).toISOString();
      const finished = dur ? new Date(Date.parse(started) + dur).toISOString() : undefined;
      this.syncHistory.push({
        id: randomUUID(),
        connectorId: cid,
        connector: cname,
        agentId: AGENT_IDS[connIdx % 2]!,
        startedAt: started,
        finishedAt: finished,
        durationMs: dur,
        result,
        synced: dur ? 50 + Math.floor(Math.random() * 500) : 0,
        skipped: Math.floor(Math.random() * 20),
        failed: result === 'FAILED' ? 5 : 0,
        entities: ['PRODUCT', 'CUSTOMER', 'INVENTORY'].slice(0, 1 + (i % 3)),
        errors: result === 'FAILED' ? ['Connection timeout after 30s'] : [],
      });
    }

    // Logs
    const messages = [
      { level: 'info' as LogLevel, msg: 'Sync completed successfully', conn: 'ERP-Prod' },
      { level: 'info' as LogLevel, msg: 'Sync completed successfully', conn: 'CRM-Prod' },
      { level: 'warn' as LogLevel, msg: 'Pool usage at 90%', conn: 'CRM-Prod' },
      { level: 'error' as LogLevel, msg: 'Connection timeout after 30s', conn: 'ERP-Staging' },
      { level: 'info' as LogLevel, msg: 'Agent heartbeat received', conn: undefined },
      { level: 'debug' as LogLevel, msg: 'Schema diff: 0 changes detected', conn: 'ERP-Prod' },
      { level: 'warn' as LogLevel, msg: 'Retry attempt 1/3', conn: 'ERP-Staging' },
      { level: 'fatal' as LogLevel, msg: 'Database connection refused', conn: 'ERP-Staging' },
    ];
    for (let i = 0; i < 100; i++) {
      const m = messages[i % messages.length]!;
      this.logs.push({
        id: randomUUID(),
        timestamp: new Date(Date.now() - i * 90_000).toISOString(),
        level: m.level,
        connector: m.conn,
        agent: 'prod-worker-01',
        message: m.msg,
      });
    }

    // Users
    const users: HubUser[] = [
      {
        id: randomUUID(),
        name: 'Super Admin',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
        active: true,
        createdAt: minutesAgo(43200),
        lastLogin: minutesAgo(30),
      },
      {
        id: randomUUID(),
        name: 'Operator',
        email: 'ops@example.com',
        role: 'OPERATOR',
        active: true,
        createdAt: minutesAgo(21600),
        lastLogin: minutesAgo(120),
      },
      {
        id: randomUUID(),
        name: 'Viewer',
        email: 'viewer@example.com',
        role: 'READ_ONLY',
        active: true,
        createdAt: minutesAgo(10800),
        lastLogin: minutesAgo(720),
      },
    ];
    users.forEach((u) => this.users.set(u.id, u));
  }

  private _defaultSettings(): HubSettings {
    return {
      sync: {
        intervalMs: 60_000,
        retryAttempts: 3,
        timeoutMs: 30_000,
        batchSize: 100,
        enableIncremental: true,
      },
      cache: { ttlMs: 1_800_000, maxEntries: 1_000 },
      discovery: { autoRunOnConnect: true, confidenceMinimum: 60, schemaTtlMs: 3_600_000 },
      notifications: {
        enableEmailAlerts: false,
        alertEmail: '',
        alertOnFailure: true,
        alertOnDegraded: true,
      },
    };
  }
}

export const hubStore = new HubStore();
