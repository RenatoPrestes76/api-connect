# @seltriva/core/services

Service-layer interfaces — Middleware, Pipelines, Interceptors, Health Checks, and the Logger contract.

## Purpose

Provides the cross-cutting concern contracts that wrap every service call: request/response middleware pipelines, pre/post interceptors, structured error handling, health monitoring, and the canonical logger interface used throughout all packages.

## Interfaces

| Interface | Role |
|-----------|------|
| `Middleware<Req, Res>` | Single step in a request/response pipeline |
| `RequestContext` | Immutable request envelope with correlation metadata |
| `ResponseContext` | Immutable response envelope with status and error |
| `Pipeline<Req, Res>` | Ordered collection of Middleware — compose and execute |
| `Interceptor<T>` | Pre/post-process any typed value |
| `InterceptorChain<T>` | Ordered sequence of Interceptors |
| `ErrorInterceptor` | Single-error-type boundary with priority |
| `ErrorMiddleware<Req, Res>` | Middleware that specialises in error recovery |
| `HealthCheck` | Single health probe |
| `HealthCheckResult` | Outcome: healthy / degraded / unhealthy |
| `HealthCheckRegistry` | Aggregates all probes and computes overall status |
| `Logger` | Structured log levels + child loggers with context |

## Architecture

```
Request
  ↓ Pipeline<Req, Res>
  ↓   Middleware (auth)   order: 10
  ↓   Middleware (trace)  order: 20
  ↓   Middleware (rate)   order: 30
  ↓   ErrorMiddleware     order: 99
Response
```

## Logger Convention

```typescript
const log = logger.child({ module: 'sync', sourceId });
log.info('starting sync');
log.error('sync failed', err, { recordId });
```

## Constraints

- No concrete implementations in this module.
- Middleware order is ascending (lower runs first).
- `Logger.child()` must inherit parent context and merge new fields.
- All health checks must complete within a bounded timeout (set by the registry implementation).
