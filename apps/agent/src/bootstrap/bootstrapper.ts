/**
 * AgentBootstrapperImpl — concrete implementation of AgentBuilder.
 * Runs the 7-phase startup sequence and returns a live AgentInstance.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir, hostname, platform, arch } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AgentBuilder,
  AgentInstance,
  AgentBootstrapPhase,
  AgentBootstrapResult,
  AgentPhaseResult,
  AgentBootstrapHook,
  AgentBootstrapObserver,
} from './index.js';
import type { AgentConfig } from '../configuration/index.js';
import type { AgentContext, Disposable } from '../runtime/index.js';
import type { AgentResult } from '../configuration/index.js';
import {
  AGENT_BOOTSTRAP_PHASE_ORDER,
  AGENT_ID_ENV_VAR,
  AGENT_TOKEN_ENV_VAR,
  AGENT_DATA_DIR_ENV_VAR,
} from './index.js';
import { DEFAULT_CONFIG_PATHS, CONFIG_ENV_VAR } from '../configuration/index.js';

// ─── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agent: {
    id: process.env[AGENT_ID_ENV_VAR] ?? randomUUID(),
    name: `sentinel-${hostname()}`,
    version: '0.1.0',
    environment: 'production',
    dataDir: process.env[AGENT_DATA_DIR_ENV_VAR] ?? join(homedir(), '.seltriva', 'agent'),
    tags: [],
    labels: {},
  },
  security: {
    encryptionAlgorithm: 'aes-256-gcm',
    tls: { enabled: true, rejectUnauthorized: true },
    credentialStore: { backend: 'file', path: 'credentials.enc' },
  },
  connectors: {
    databases: [],
    maxPoolSize: 10,
    connectionTimeoutMs: 30_000,
    idleTimeoutMs: 300_000,
  },
  sync: {
    mode: 'incremental',
    batchSize: 500,
    interval: 60,
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1_000,
      maxBackoffMs: 30_000,
    },
    excludedTables: [],
    includedSchemas: ['public'],
  },
  scheduler: {
    heartbeatIntervalMs: 30_000,
    healthCheckIntervalMs: 60_000,
    syncIntervalMs: 300_000,
    credentialRotationIntervalMs: 86_400_000,
  },
  health: {
    enabled: true,
    httpPort: 8080,
    thresholds: {
      cpuPct: 90,
      memPct: 85,
      diskPct: 90,
      latencyMs: 5_000,
    },
  },
  telemetry: {
    enabled: false,
    endpoint: '',
    serviceName: 'seltriva-agent',
    samplingRate: 0.1,
  },
  updates: {
    enabled: true,
    channel: 'stable',
    checkIntervalMs: 3_600_000,
    autoInstall: false,
  },
  cache: {
    driver: 'sqlite',
    path: 'cache.db',
    ttlSeconds: 3_600,
    maxSizeBytes: 104_857_600,
  },
  plugins: {
    enabled: true,
    directories: [],
    allowUnverified: false,
  },
  logs: {
    level: 'info',
    format: 'json',
    maxFileSizeMb: 50,
    maxFiles: 7,
    directory: 'logs',
  },
};

// ─── YAML Loader (minimal — no external dep) ─────────────────────────────────

function loadYamlConfig(filePath: string): Partial<AgentConfig> {
  try {
    const raw = readFileSync(filePath, 'utf8');
    // Very minimal key:value YAML parser — only supports flat + nested with 2-space indent.
    // For production use, replace with a proper YAML library.
    const result: Record<string, unknown> = {};
    const lines = raw.split('\n');
    let currentSection: string | null = null;

    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      const [rawKey, ...rest] = line.trim().split(':');
      const key = rawKey?.trim() ?? '';
      const value = rest.join(':').trim();

      if (indent === 0) {
        if (!value) { currentSection = key; result[key] = {}; }
        else {
          result[key] = coerceValue(value);
          currentSection = null;
        }
      } else if (currentSection && indent > 0) {
        (result[currentSection] as Record<string, unknown>)[key] = coerceValue(value);
      }
    }

    return result as Partial<AgentConfig>;
  } catch {
    return {};
  }
}

function coerceValue(raw: string): unknown {
  const v = raw.trim().replace(/^['"]|['"]$/g, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  const n = Number(v);
  if (!isNaN(n) && v !== '') return n;
  return v;
}

// ─── AgentInstanceImpl ───────────────────────────────────────────────────────

class AgentInstanceImpl implements AgentInstance {
  readonly context: AgentContext;
  readonly config: AgentConfig;
  private _isReady = false;
  private _isShuttingDown = false;
  private _startTime = Date.now();
  private _bootstrapDuration: number;
  private _shutdownHandlers: Array<() => void | Promise<void>> = [];

  constructor(context: AgentContext, config: AgentConfig, bootstrapDuration: number) {
    this.context = context;
    this.config = config;
    this._bootstrapDuration = bootstrapDuration;
    this._isReady = true;
  }

  get isReady(): boolean { return this._isReady; }
  get isShuttingDown(): boolean { return this._isShuttingDown; }
  get uptimeMs(): number { return Date.now() - this._startTime; }
  get bootstrapDurationMs(): number { return this._bootstrapDuration; }

  async shutdown(reason?: string): Promise<void> {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;
    this._isReady = false;

    console.log(`[Agent] Shutting down: ${reason ?? 'requested'}`);

    for (const handler of [...this._shutdownHandlers].reverse()) {
      try { await handler(); } catch { /* continue */ }
    }
  }

  onShutdown(handler: () => void | Promise<void>): Disposable {
    this._shutdownHandlers.push(handler);
    return {
      dispose: () => {
        this._shutdownHandlers = this._shutdownHandlers.filter((h) => h !== handler);
      },
    };
  }
}

// ─── AgentBootstrapperImpl ───────────────────────────────────────────────────

export class AgentBootstrapperImpl implements AgentBuilder {
  private _configPath: string | null = null;
  private _dataDir: string | null = null;
  private _skippedPhases = new Set<AgentBootstrapPhase>();
  private _beforeHooks = new Map<AgentBootstrapPhase, AgentBootstrapHook[]>();
  private _afterHooks = new Map<AgentBootstrapPhase, AgentBootstrapHook[]>();
  private _observer: AgentBootstrapObserver | null = null;

  withConfigPath(filePath: string): this {
    this._configPath = filePath;
    return this;
  }

  withDataDir(dirPath: string): this {
    this._dataDir = dirPath;
    return this;
  }

  skipPhase(phase: AgentBootstrapPhase): this {
    this._skippedPhases.add(phase);
    return this;
  }

  beforePhase(phase: AgentBootstrapPhase, hook: AgentBootstrapHook): this {
    const hooks = this._beforeHooks.get(phase) ?? [];
    hooks.push(hook);
    this._beforeHooks.set(phase, hooks);
    return this;
  }

  afterPhase(phase: AgentBootstrapPhase, hook: AgentBootstrapHook): this {
    const hooks = this._afterHooks.get(phase) ?? [];
    hooks.push(hook);
    this._afterHooks.set(phase, hooks);
    return this;
  }

  withObserver(observer: AgentBootstrapObserver): this {
    this._observer = observer;
    return this;
  }

  async build(): Promise<AgentResult<AgentInstance>> {
    const bootstrapStart = Date.now();
    const phaseResults: AgentPhaseResult[] = [];
    const ctx: Partial<AgentContext> = {};
    let config = DEFAULT_CONFIG;

    for (const phase of AGENT_BOOTSTRAP_PHASE_ORDER) {
      if (this._skippedPhases.has(phase)) {
        phaseResults.push({ phase, success: true, durationMs: 0, warnings: ['skipped'] });
        continue;
      }

      this._observer?.onPhaseStarted(phase);

      const beforeHooks = this._beforeHooks.get(phase) ?? [];
      for (const hook of beforeHooks) {
        try { await hook(phase, ctx); } catch { /* non-fatal */ }
      }

      const phaseStart = Date.now();
      const warnings: string[] = [];

      try {
        switch (phase) {
          case 'configuration':
            config = await this._runConfiguration(warnings);
            if (this._dataDir) {
              (config.agent as { dataDir: string }).dataDir = this._dataDir;
            }
            break;

          case 'security':
            await this._runSecurity(config, warnings);
            break;

          case 'services':
            await this._runServices(config, ctx, warnings);
            break;

          case 'connectors':
            await this._runConnectors(config, warnings);
            break;

          case 'scheduler':
            await this._runScheduler(config, warnings);
            break;

          case 'plugins':
            await this._runPlugins(config, warnings);
            break;

          case 'ready':
            await this._runReady(config, warnings);
            break;
        }

        const result: AgentPhaseResult = {
          phase,
          success: true,
          durationMs: Date.now() - phaseStart,
          warnings,
        };

        phaseResults.push(result);
        this._observer?.onPhaseCompleted(result);

        const afterHooks = this._afterHooks.get(phase) ?? [];
        for (const hook of afterHooks) {
          try { await hook(phase, ctx); } catch { /* non-fatal */ }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const result: AgentPhaseResult = {
          phase,
          success: false,
          durationMs: Date.now() - phaseStart,
          warnings,
          error: error.message,
        };

        phaseResults.push(result);
        this._observer?.onPhaseFailed(phase, error);

        const bootstrapResult: AgentBootstrapResult = {
          success: false,
          phaseResults,
          totalDurationMs: Date.now() - bootstrapStart,
          failedPhase: phase,
          error,
        };

        this._observer?.onBootstrapCompleted(bootstrapResult);

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: `Bootstrap failed at phase [${phase}]: ${error.message}`,
            cause: error,
          },
          timestamp: new Date(),
        };
      }
    }

    const agentCtx = ctx as AgentContext;
    const instance = new AgentInstanceImpl(agentCtx, config, Date.now() - bootstrapStart);

    // Wire up signal handlers
    const shutdown = () => void instance.shutdown('signal');
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    const bootstrapResult: AgentBootstrapResult = {
      success: true,
      agent: instance,
      phaseResults,
      totalDurationMs: Date.now() - bootstrapStart,
    };

    this._observer?.onBootstrapCompleted(bootstrapResult);

    return { success: true, data: instance, timestamp: new Date() };
  }

  // ─── Phase 1: Configuration ────────────────────────────────────────────────

  private async _runConfiguration(warnings: string[]): Promise<AgentConfig> {
    const configPath = this._resolveConfigPath();

    if (!configPath) {
      warnings.push('No config file found — using defaults');
      return DEFAULT_CONFIG;
    }

    const fileConfig = loadYamlConfig(configPath);

    // Deep merge: file overrides defaults
    const merged: AgentConfig = {
      agent:      { ...DEFAULT_CONFIG.agent,     ...(fileConfig.agent     ?? {}) },
      security:   { ...DEFAULT_CONFIG.security,  ...(fileConfig.security  ?? {}) },
      connectors: { ...DEFAULT_CONFIG.connectors, ...(fileConfig.connectors ?? {}) },
      sync:       { ...DEFAULT_CONFIG.sync,      ...(fileConfig.sync      ?? {}) },
      scheduler:  { ...DEFAULT_CONFIG.scheduler,  ...(fileConfig.scheduler  ?? {}) },
      health:     { ...DEFAULT_CONFIG.health,    ...(fileConfig.health    ?? {}) },
      telemetry:  { ...DEFAULT_CONFIG.telemetry, ...(fileConfig.telemetry ?? {}) },
      updates:    { ...DEFAULT_CONFIG.updates,   ...(fileConfig.updates   ?? {}) },
      cache:      { ...DEFAULT_CONFIG.cache,     ...(fileConfig.cache     ?? {}) },
      plugins:    { ...DEFAULT_CONFIG.plugins,   ...(fileConfig.plugins   ?? {}) },
      logs:       { ...DEFAULT_CONFIG.logs,      ...(fileConfig.logs      ?? {}) },
    };

    // Apply environment variable overrides
    if (process.env[AGENT_ID_ENV_VAR]) {
      (merged.agent as { id: string }).id = process.env[AGENT_ID_ENV_VAR]!;
    }
    if (process.env[AGENT_DATA_DIR_ENV_VAR]) {
      (merged.agent as { dataDir: string }).dataDir = process.env[AGENT_DATA_DIR_ENV_VAR]!;
    }

    console.log(`[Phase 1] Config loaded from ${configPath}`);
    return merged;
  }

  private _resolveConfigPath(): string | null {
    // 1. Explicit override
    if (this._configPath && existsSync(this._configPath)) return this._configPath;

    // 2. Environment variable
    const envPath = process.env[CONFIG_ENV_VAR];
    if (envPath && existsSync(envPath)) return envPath;

    // 3. Default search paths
    for (const p of DEFAULT_CONFIG_PATHS) {
      const resolved = p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
      if (existsSync(resolved)) return resolved;
    }

    return null;
  }

  // ─── Phase 2: Security ────────────────────────────────────────────────────

  private async _runSecurity(config: AgentConfig, warnings: string[]): Promise<void> {
    const token = process.env[AGENT_TOKEN_ENV_VAR];
    if (!token) {
      warnings.push('SELTRIVA_AGENT_TOKEN not set — cloud features will be unavailable');
    }

    if (!config.security.tls.enabled) {
      warnings.push('TLS is disabled — not recommended for production');
    }

    console.log('[Phase 2] Security initialized');
  }

  // ─── Phase 3: Services ────────────────────────────────────────────────────

  private async _runServices(
    config: AgentConfig,
    ctx: Partial<AgentContext>,
    warnings: string[],
  ): Promise<void> {
    // Telemetry
    if (!config.telemetry.enabled) {
      warnings.push('Telemetry disabled');
    }

    // Set minimal AgentContext fields
    (ctx as Record<string, unknown>)['agentId'] = config.agent.id;
    (ctx as Record<string, unknown>)['startTime'] = new Date();
    (ctx as Record<string, unknown>)['environment'] = config.agent.environment;
    (ctx as Record<string, unknown>)['version'] = config.agent.version;
    (ctx as Record<string, unknown>)['dataDir'] = config.agent.dataDir;
    (ctx as Record<string, unknown>)['hostname'] = hostname();
    (ctx as Record<string, unknown>)['platform'] = platform();
    (ctx as Record<string, unknown>)['arch'] = arch();
    (ctx as Record<string, unknown>)['nodeVersion'] = process.version;

    console.log('[Phase 3] Services initialized');
  }

  // ─── Phase 4: Connectors ─────────────────────────────────────────────────

  private async _runConnectors(config: AgentConfig, warnings: string[]): Promise<void> {
    const dbs = config.connectors.databases;

    if (dbs.length === 0) {
      warnings.push('No database connectors configured');
      console.log('[Phase 4] No connectors to initialize');
      return;
    }

    console.log(`[Phase 4] Initializing ${dbs.length} connector(s)`);

    for (const db of dbs) {
      try {
        // Lazy connect — actual pool opens on first query
        console.log(`[Phase 4]   ✓ ${db.type} connector "${db.id}" registered`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Connector "${db.id}" failed to initialize: ${msg}`);
        console.warn(`[Phase 4]   ✗ ${db.type} connector "${db.id}" failed: ${msg}`);
        // Non-fatal: continue
      }
    }
  }

  // ─── Phase 5: Scheduler ──────────────────────────────────────────────────

  private async _runScheduler(config: AgentConfig, _warnings: string[]): Promise<void> {
    const { heartbeatIntervalMs, healthCheckIntervalMs } = config.scheduler;

    console.log('[Phase 5] Scheduler configured');
    console.log(`[Phase 5]   heartbeat every ${heartbeatIntervalMs / 1000}s`);
    console.log(`[Phase 5]   health check every ${healthCheckIntervalMs / 1000}s`);
    // Actual job registration deferred to AgentRuntime startup
  }

  // ─── Phase 6: Plugins ─────────────────────────────────────────────────────

  private async _runPlugins(config: AgentConfig, warnings: string[]): Promise<void> {
    if (!config.plugins.enabled) {
      warnings.push('Plugin system disabled');
      console.log('[Phase 6] Plugins disabled');
      return;
    }

    const dirs = config.plugins.directories;
    if (dirs.length === 0) {
      console.log('[Phase 6] No plugin directories configured');
      return;
    }

    let loaded = 0;
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        warnings.push(`Plugin directory not found: ${dir}`);
        continue;
      }
      // Plugin discovery deferred to AgentPluginManager
      loaded++;
    }

    console.log(`[Phase 6] Discovered ${loaded} plugin director${loaded === 1 ? 'y' : 'ies'}`);
  }

  // ─── Phase 7: Ready ───────────────────────────────────────────────────────

  private async _runReady(config: AgentConfig, warnings: string[]): Promise<void> {
    const cloudUrl = process.env['SELTRIVA_CLOUD_URL'];
    if (!cloudUrl) {
      warnings.push('SELTRIVA_CLOUD_URL not set — skipping agent registration');
    } else {
      // Attempt registration (non-fatal if fails)
      try {
        await this._registerWithCloud(config, cloudUrl);
        console.log('[Phase 7] Agent registered with platform');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Cloud registration failed: ${msg} — running in standalone mode`);
        console.warn(`[Phase 7] Registration failed: ${msg}`);
      }
    }

    console.log(`[Phase 7] Agent ready — id=${config.agent.id} name=${config.agent.name}`);
    process.emit('agent:ready' as never);
  }

  private async _registerWithCloud(config: AgentConfig, cloudUrl: string): Promise<void> {
    const token = process.env[AGENT_TOKEN_ENV_VAR];
    if (!token) throw new Error('Agent token not set');

    const res = await fetch(`${cloudUrl}/api/v1/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: config.agent.name,
        version: config.agent.version,
        hostname: hostname(),
        platform: platform(),
        arch: arch(),
        nodeVersion: process.version,
        capabilities: config.connectors.databases.map((d) => d.type),
        metadata: config.agent.labels,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgent(): AgentBootstrapperImpl {
  return new AgentBootstrapperImpl();
}
