# @seltriva/runtime — Connect Runtime Platform (CRP)

The operating core of Seltriva Connect. Responsible for loading, orchestrating, monitoring, and managing every module of the platform.

## What it does

The CRP is the infrastructure kernel — it makes everything else run. It provides:

- **Startup orchestration** — ordered 7-phase bootstrap sequence
- **Module lifecycle** — init/start/stop/destroy state machine for all modules
- **Dependency injection** — typed service container with scoping
- **Plugin management** — safe loading, sandboxing, and hot-reload of plugins
- **Event/Command bus** — async pub/sub and typed command dispatch
- **Scheduler** — cron, interval, once, and event-triggered jobs
- **Worker pool** — priority-queued concurrent task execution
- **Resilience** — circuit breakers, retries, bulkheads, rate limiting
- **Health monitoring** — liveness, readiness, and dependency checks
- **Telemetry** — structured logging, distributed tracing, metrics
- **Diagnostics** — runtime snapshots, topology, audit trail
- **Orchestration** — multi-module sagas and coordinated operations

## What it does NOT do

- Implement business logic of any kind
- Expose HTTP endpoints or UI pages
- Handle authentication or authorization for end users
- Contain ERP-specific implementations

---

## Bootstrap Sequence

```
                    PLATFORM BUILDER
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 1: CONFIGURATION                              │
    │    Load .env → load files → load Supabase remote    │
    │    Validate all required keys against schema         │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 2: DEPENDENCY INJECTION                       │
    │    Build service container                           │
    │    Register core platform service tokens             │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 3: SERVICE REGISTRATION                       │
    │    Init database, Supabase, cache                    │
    │    Init event bus, command bus                       │
    │    Init telemetry, health monitor, resilience        │
    │    Init permission model, sandbox manager            │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 4: PLUGIN LOADING                             │
    │    Discover plugins from configured directories      │
    │    Validate manifests, check conflicts               │
    │    Create sandboxes, init and start each plugin      │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 5: SCHEDULER INIT                             │
    │    Register built-in recurring jobs                  │
    │    Start scheduler clock                             │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 6: WORKER INIT                                │
    │    Spawn worker pools                                │
    │    Wait for all workers to reach idle                │
    └─────────────────────┬───────────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────────┐
    │  Phase 7: READY                                      │
    │    Emit platform.ready event                         │
    │    Start health polling                              │
    │    Log startup summary                               │
    └─────────────────────┬───────────────────────────────┘
                          │
                  PlatformContext (live platform)
```

---

## Module Reference

### `kernel/`

Foundation — all modules depend on this.

**Branded IDs:** `ModuleId`, `ServiceId`, `PluginId`, `WorkerId`, `WorkerPoolId`, `JobId`, `CommandId`, `EventId`, `CorrelationId`, `TraceId`, `SandboxId`

**`RuntimeResult<T>`** — every CRP operation returns this, never throws:
```typescript
interface RuntimeResult<T> { success, data?, error?, durationMs?, timestamp }
```

**`PLATFORM_EVENTS`** — 23 named platform lifecycle event constants.

**`PlatformKernel`** — root coordinator: `shutdown()`, `emit()`, `on()`.

---

### `lifecycle/`

Module lifecycle state machine.

```
created → initializing → initialized → starting → running → stopping → stopped → destroying → destroyed
                                                                                       ↑
                                                                  error ──────────────┘
```

**`LifecycleModule`** — every module implements: `init()`, `start()`, `stop()`, `destroy()`.

**`LifecycleManager`** — `initAll()`, `startAll()`, `stopAll()`, `destroyAll()` in dependency order.

**`LifecycleDependencyGraph`** — topological sort for startup/shutdown ordering, cycle detection.

---

### `configuration/`

Multi-source typed configuration.

**Sources (priority order):** environment variables → Supabase remote → JSON/YAML files → defaults

**`ConfigurationProvider`** — `get<T>()`, `require<T>()`, `watch()`, `reload()`, `validate()`

**`SecretProvider`** — secrets never logged, access audited.

**`FeatureFlagProvider`** — feature flags with rollout percentages and variants.

**Built-in namespaces:** `platform`, `database`, `supabase`, `ai`, `scheduler`, `worker`, `telemetry`, `health`, `resilience`, `security`, `cache`, `queue`.

---

### `permissions/`

Capability-based access control.

Modules start with **no permissions** and are granted specific capabilities at registration. This is the enforcement layer for sandbox safety.

**Principals:** `module`, `plugin`, `service`, `system`

**Resources:** `service`, `event`, `command`, `configuration`, `secret`, `file-system`, `network`, `database`, `worker-pool`, `scheduler`, `telemetry`, `module`, `platform`

**Built-in roles:** `core-module`, `plugin-standard`, `plugin-trusted`, `readonly`, `observer`

---

### `telemetry/`

Three pillars of observability:

| Pillar | Interface | Key Methods |
|---|---|---|
| Logging | `RuntimeLogger` | `fatal/error/warn/info/debug/trace`, `child()`, `bind()` |
| Tracing | `RuntimeTracer` | `startSpan()`, `startChildSpan()`, `withSpan()`, W3C inject/extract |
| Metrics | `RuntimeMeter` | `createCounter()`, `createGauge()`, `createHistogram()` |

**`TelemetryExporter`** — plugin interface for forwarding to OpenTelemetry/Datadog/Prometheus/etc.

---

### `event-bus/`

Async pub/sub with dead-letter queue.

**Topic naming:** `{domain}.{aggregate}.{verb}` — e.g., `connector.schema.registered`, `sync.job.completed`

**Pattern wildcards:** `connector.*` (single level), `sync.#` (multi-level)

**27 built-in `EVENT_TOPICS`** across platform, connector, schema, mapping, sync, and AI domains.

---

### `command-bus/`

Typed request/response command dispatch.

**`CommandBus`** — `dispatch<TResult>()`, `send()`, `register()`, `use()`

**`CommandMiddleware`** — pipeline: authentication → validation → logging → tracing → handler

**26 built-in `COMMAND_TYPES`** for lifecycle, plugins, scheduler, workers, and platform.

---

### `service-registry/`

Dependency injection container.

**Lifetimes:** `singleton`, `transient`, `scoped`

**`SERVICE_TOKENS`** — 23 named tokens for all platform services:
- `PLATFORM_KERNEL`, `EVENT_BUS`, `COMMAND_BUS`, `SCHEDULER`, `WORKER_POOL_MANAGER`
- `TELEMETRY_PROVIDER`, `LOGGER`, `TRACER`, `METER`
- `HEALTH_MONITOR`, `PERMISSION_MODEL`, `SANDBOX_MANAGER`, `RESILIENCE_FACTORY`
- `PLUGIN_MANAGER`, `MODULE_LOADER`, `ORCHESTRATOR`
- `DATABASE_CLIENT`, `SUPABASE_CLIENT`, `CACHE_PROVIDER`

---

### `health/`

Kubernetes-style health probes.

**Probes:** `liveness` (restart if fails), `readiness` (remove from LB if fails), `startup` (init guard), `dependency`

**`HealthEndpointFormatter`** — formats reports for `/health`, `/health/ready`, `/health/live`.

**10 built-in `HEALTH_CHECK_IDS`** — database, Supabase, event bus, command bus, scheduler, worker pool, memory, disk, plugin manager, telemetry exporter.

---

### `resilience/`

Fault tolerance patterns (composable policies).

| Policy | Interface | Key Options |
|---|---|---|
| Circuit Breaker | `CircuitBreaker` | `failureThreshold`, `timeoutMs`, `halfOpenMaxCalls` |
| Retry | `RetryPolicy` | `maxAttempts`, `delayMs`, `backoffMultiplier`, `jitter` |
| Bulkhead | `BulkheadPolicy` | `maxConcurrent`, `maxQueueDepth`, `queueTimeoutMs` |
| Timeout | `TimeoutPolicy` | `timeoutMs` |
| Rate Limiter | `RateLimiter` | `token-bucket`, `sliding-window`, `fixed-window` |
| Fallback | `FallbackPolicy<T>` | static value or factory |

**`ResiliencePipeline`** — compose: `timeout → circuit-breaker → retry → bulkhead`

---

### `sandbox/`

Plugin isolation and resource containment.

**Levels:**

| Level | Access |
|---|---|
| `strict` | config read, events, telemetry only |
| `standard` | + commands, services, FS read, network, workers, scheduler |
| `trusted` | + config write, secrets, FS write, database |
| `native` | unrestricted (core runtime modules only) |

**`SandboxViolationAction`** — `log`, `warn`, or `terminate` sandbox on policy breach.

**19 `SandboxCapability`** values covering every resource type.

---

### `plugin-manager/`

Plugin lifecycle with manifest-driven safety.

```
registered → loading → loaded → starting → running
                                               ↓
                                         disabled / error / unloaded
```

**`PluginManifest`** — declares capabilities, sandbox level, dependencies, services, events.

**`PluginContext`** — injected into each plugin: `resolveService()`, `publishEvent()`, `subscribeEvent()`, `getConfig()`, `getLogger()`.

**`PluginValidator`** — validates manifests, detects conflicts, checks capability grants.

---

### `module-loader/`

Dynamic module loading from workspace, NPM, file, or remote URL.

**`ModuleCatalog`** — discover available modules.

**`ModuleVersionRegistry`** — multiple versions per module, rollback support.

---

### `scheduler/`

Reliable job scheduling.

**Triggers:**

| Kind | Description |
|---|---|
| `cron` | Standard cron expression with timezone |
| `interval` | Fixed interval with initial delay |
| `once` | Single execution at a specific time |
| `event` | Triggered by an event bus topic match |

**8 built-in `BUILT_IN_JOB_IDS`** — health check, telemetry flush, memory consolidation, dead-letter retry, diagnostics snapshot, plugin health check, resilience metrics, circuit breaker sweep.

---

### `worker-pool/`

Priority-queued concurrent task execution.

**Priorities:** `critical` → `high` → `normal` → `low` → `background`

**`WorkerPool`** — `submit<T>()`, `submitBatch()`, `resize()`, `pause()`, `resume()`, `drain()`

**Backpressure** — rejects when queue is full; configurable `queueCapacity`.

---

### `diagnostics/`

Runtime introspection for debugging and observability.

**`PlatformSnapshot`** — complete state: modules, services, jobs, workers, plugins, resilience, health, memory.

**`PlatformTopology`** — visual dependency graph with startup/shutdown order, critical path, cycles.

**`DiagnosticCheck`** — pluggable checks in 7 categories: configuration, connectivity, performance, memory, security, integrity, compatibility.

**`AuditTrail`** — timestamped log of significant platform events.

---

### `orchestration/`

Multi-step coordinated operations across modules.

**Steps** can be: command dispatch, event publish, service call, wait, or conditional branch.

**Compensation** — each step can declare a rollback action; `SagaCoordinator` handles long-running sagas.

**9 built-in `WORKFLOW_IDS`** — platform startup/shutdown, plugin install/uninstall, module hot-reload, connector register/deregister, schema registration, sync initialization.

---

### `bootstrap/`

The `PlatformBuilder` fluent API:

```typescript
const platform = await new PlatformBuilder()
  .withEnvironment('production')
  .addConfigSource(envConfigSource)
  .addConfigSource(supabaseConfigSource)
  .addContainerModule(coreServicesModule)
  .addPluginDirectory('./plugins')
  .beforePhase('ready', async () => { /* pre-ready hook */ })
  .bootstrap();

if (platform.success) {
  const ctx = platform.data!;
  ctx.services.resolve(SERVICE_TOKENS.SCHEDULER).trigger(BUILT_IN_JOB_IDS.HEALTH_CHECK);
}
```

---

## Extension Guide

### Adding a new module

```typescript
class MyModule implements LifecycleModule {
  readonly descriptor: ModuleDescriptor = {
    id: 'my-module' as ModuleId,
    name: 'My Module',
    kind: 'integration',
    version: '1.0.0',
    description: 'My custom integration module',
    dependencies: [/* other module IDs */],
    provides: ['my-service' as ServiceId],
    consumes: [SERVICE_TOKENS.EVENT_BUS as unknown as ServiceId],
  };
  state: LifecycleState = 'created';
  // ...

  async init(context: RuntimeContext): Promise<RuntimeResult<void>> {
    // Load config, validate dependencies
    return { success: true, timestamp: new Date() };
  }

  async start(): Promise<RuntimeResult<void>> {
    // Bind ports, start goroutines
    return { success: true, timestamp: new Date() };
  }

  async stop()    { return { success: true, timestamp: new Date() }; }
  async destroy() { return { success: true, timestamp: new Date() }; }
  async healthCheck() { return { healthy: true, state: 'running' }; }
}
```

### Writing a plugin

```typescript
export default class MyPlugin implements Plugin {
  readonly manifest: PluginManifest = {
    id: 'plugin-my-extension' as PluginId,
    name: 'My Extension',
    version: '1.0.0',
    description: 'Adds custom integration capability',
    entryPoint: './index.js',
    sandboxLevel: 'standard',
    requiredCapabilities: ['publish-events', 'subscribe-events', 'access-service'],
    publishesTopics: ['my-extension.data.processed'],
    subscribesTopics: ['connector.schema.registered'],
  };

  async init(ctx: PluginContext) {
    ctx.subscribeEvent('connector.schema.registered', async (event) => {
      // handle event
    });
    return { success: true, timestamp: new Date() };
  }

  async start()   { return { success: true, timestamp: new Date() }; }
  async stop()    { return { success: true, timestamp: new Date() }; }
  async destroy() { return { success: true, timestamp: new Date() }; }
}
```

### Adding a resilience policy

```typescript
const factory = services.resolve<ResilienceFactory>(SERVICE_TOKENS.RESILIENCE_FACTORY);

const policy = factory.pipeline(
  factory.timeout({ id: 'my-op-timeout', timeoutMs: 5000 }),
  factory.circuitBreaker({
    id: 'my-op-circuit',
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 30000,
  }),
  factory.retry({
    id: 'my-op-retry',
    maxAttempts: 3,
    delayMs: 200,
    backoffMultiplier: 2,
  }),
);

const result = await policy.execute(() => callExternalService());
```

### Scheduling a job

```typescript
const scheduler = services.resolve<Scheduler>(SERVICE_TOKENS.SCHEDULER);

scheduler.define({
  id: 'job-my-task' as JobId,
  name: 'My Recurring Task',
  ownerModuleId: 'my-module' as ModuleId,
  trigger: { kind: 'cron', expression: '0 */6 * * *', timezone: 'America/Sao_Paulo' },
  priority: 'normal',
  timeoutMs: 60_000,
  handler: async (ctx) => {
    // task logic
    return { success: true };
  },
});

scheduler.schedule('job-my-task' as JobId);
```

---

## Lifecycle Sequence Diagrams

### Module Startup

```
LifecycleManager          Module A (no deps)      Module B (depends on A)
      │                         │                          │
      │──initAll()──────────────►│                          │
      │                    init(ctx)                        │
      │◄────────────────────────│                          │
      │                         │──────────────────────────►│
      │                         │                     init(ctx)
      │◄────────────────────────┼──────────────────────────│
      │                         │                          │
      │──startAll()─────────────►│                          │
      │                    start()                          │
      │◄────────────────────────│                          │
      │                         │──────────────────────────►│
      │                         │                     start()
      │◄────────────────────────┼──────────────────────────│
      │                         │ (running)                 │ (running)
```

### Graceful Shutdown (reverse order)

```
PlatformKernel            Module B               Module A
      │                      │                      │
      │──shutdown()──────────►│                      │
      │                  stop()                      │
      │◄─────────────────────│                      │
      │                      │──────────────────────►│
      │                      │                  stop()
      │◄─────────────────────┼──────────────────────│
      │──destroyAll()─────────────────────────────►  │
```

---

## Package Info

| Field | Value |
|---|---|
| Package | `@seltriva/runtime` |
| Version | `0.1.0` |
| Runtime | Node.js 18+ |
| TypeScript | `strict: true`, `moduleResolution: "bundler"` |
| Dependencies | `@seltriva/core`, `@seltriva/types` |
| Side effects | None |
| Architecture | Hexagonal, DDD, SOLID, Dependency Injection |
| Stack | Next.js (app), TypeScript, pnpm/Turborepo, Supabase, Prisma, Vercel |
