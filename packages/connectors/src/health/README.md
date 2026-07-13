# @seltriva/connectors/health

Health Engine — comprehensive, observable health monitoring for every connector.

## Purpose

Every connector must be observable. The Health Engine provides latency metrics, connection pool stats, authentication status, permission checks, version compatibility, and server information — all in a single structured `HealthReport`.

## HealthEngine Interface

```typescript
interface HealthEngine {
  check()                    → HealthReport      // full deep check
  ping()                     → PingResult        // lightweight latency check
  checkComponent(component)  → ComponentHealthResult
  startMonitoring(options)   → void
  stopMonitoring()           → void
  onStatusChange(handler)    → subscriptionId
  offStatusChange(id)        → void
  getLastReport()            → HealthReport | null
}
```

## HealthReport Structure

```
HealthReport
  ├─ status               healthy | degraded | unhealthy | unknown
  ├─ components[]         per-component results
  ├─ latency
  │    ├─ currentMs
  │    ├─ averageMs
  │    ├─ p50Ms / p95Ms / p99Ms
  │    └─ rating          excellent | good | acceptable | poor | critical
  ├─ connection
  │    ├─ connected
  │    ├─ state           open | closed | unstable | pooled
  │    ├─ poolSize / activeConnections / idleConnections
  │    └─ connectedSince
  ├─ authentication
  │    ├─ authenticated
  │    ├─ identity / roles
  │    └─ expiresAt / isExpired
  ├─ permissions[]
  │    └─ resource + canRead/Write/Create/Delete/Admin
  ├─ version
  │    ├─ serverVersion / driverVersion / protocolVersion
  │    └─ isVersionSupported
  ├─ serverInfo
  │    ├─ host / port / region / timezone
  │    └─ uptime / features
  └─ warnings[]
       └─ code + severity + recommendation
```

## Health Status Levels

| Status      | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `healthy`   | All checks pass, latency is good                            |
| `degraded`  | Operational but with warnings (high latency, pool pressure) |
| `unhealthy` | Critical failures; connector should not be used             |
| `unknown`   | Health check could not complete                             |

## Warning Codes

| Code                        | Meaning                                |
| --------------------------- | -------------------------------------- |
| `HIGH_LATENCY`              | Latency above acceptable threshold     |
| `CONNECTION_POOL_EXHAUSTED` | No free connections available          |
| `AUTH_EXPIRING_SOON`        | Token expires within 15 minutes        |
| `AUTH_EXPIRED`              | Authentication has expired             |
| `PERMISSION_MISSING`        | Required permission not granted        |
| `VERSION_UNSUPPORTED`       | Server version below minimum           |
| `VERSION_DEPRECATED`        | Server version approaching end-of-life |
| `SSL_EXPIRING_SOON`         | Certificate expires within 7 days      |
| `RATE_LIMIT_APPROACHING`    | Close to rate limit threshold          |
| `CONNECTION_UNSTABLE`       | Multiple reconnection attempts         |

## Continuous Monitoring

```typescript
engine.startMonitoring({
  intervalMs: 30_000,
  components: ['connection', 'latency', 'authentication'],
  alertOnStatus: ['degraded', 'unhealthy'],
  timeout: 5_000,
});

engine.onStatusChange((event) => {
  if (event.currentStatus === 'unhealthy') {
    alertOncall(event);
  }
});
```

## Constraints

- No implementations in this module.
- `check()` must NEVER throw — all errors are captured in `HealthReport`.
- `ping()` must complete within 5 seconds maximum.
- `startMonitoring` must not block the event loop.
