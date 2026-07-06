# Atlas Cloud — Module Documentation

## domain

**Purpose:** Core business types. No framework dependencies.

**Exports:**
- Branded IDs (14): `OrganizationId`, `WorkspaceId`, `EnvironmentId`, `AgentId`, `UserId`, `PluginId`, `LicenseId`, `ConfigurationId`, `FeatureFlagId`, `ApiKeyId`, `JobId`, `NotificationId`, `AuditEntryId`, `MetricSnapshotId`
- Value objects: `Slug`, `Email`, `SemVer`, `KeyHash`, `KeyPrefix`
- Entity interfaces: `Organization`, `Workspace`, `Environment`, `Agent`, `AgentHeartbeat`, `User`, `OrganizationMember`, `Plugin`, `License`, `FeatureFlag`, `Configuration`, `ApiKey`
- Repository interfaces: `IOrganizationRepository`, `IAgentRepository`, `IUserRepository`, `IPluginRepository`, `ILicenseRepository`, `IConfigurationRepository`, `IAuditRepository` (+2)
- Domain events: `OrganizationCreated`, `AgentRegistered`, `AgentStatusChanged`, `LicenseActivated`, `PluginInstalled`, `UserInvited` (+2)
- `DomainResult<T>`, `DomainError`, `DomainErrorCode`

---

## application

**Purpose:** CQRS — all commands (write), all queries (read).

**Exports:**
- `ICommandBus`, `IQueryBus`
- `Command<TResult>`, `Query<TResult>` phantom types
- 22 command types (Organization×5, Workspace×3, Environment×2, Agent×4, User/Member×4, Plugin×3, License×2, ApiKey×2, Configuration×2)
- Corresponding query types
- Application service interfaces: `IOrganizationApplicationService`, `IAgentApplicationService`, `ILicenseApplicationService`

---

## infrastructure

**Purpose:** DI contracts for all external adapters.

**Exports:**
- `INFRASTRUCTURE_TOKENS` — 9 DI symbols
- `IRealtimePublisher` — Supabase Realtime
- `ICacheProvider` + `CACHE_KEYS`
- `IStorageProvider` + `STORAGE_BUCKETS`
- `IEmailProvider` — email sending
- `IWebhookProvider` — webhook delivery + signature
- `IQueueProvider` — job queue
- `IEncryptionProvider` — AES + PBKDF2 + HMAC
- `ISupabaseAuthAdapter` — JWT + session
- `IRateLimiter` + `RATE_LIMIT_POLICIES`
- `ITransactionManager`

---

## api

**Purpose:** HTTP contract types. Used by both server handlers and client SDKs.

**Exports:**
- `ApiResponse<T>`, `ApiError`, `ApiMeta`, `PaginationMeta`
- `ApiRequestContext` — per-request security context
- Request/response types for all 30 endpoints
- `API_ROUTES` const (30 route paths)
- `API_SCOPES` const (18 OAuth-style scopes)
- `IAuthMiddleware`, `IValidationMiddleware`

---

## runtime

**Purpose:** Cloud lifecycle and bootstrap sequence.

**Exports:**
- `ICloudRuntime`, `CloudRuntimeStatus`, `ProcessMetrics`
- `CloudBootstrapPhase`, `CLOUD_BOOTSTRAP_PHASE_ORDER`
- `CLOUD_BOOTSTRAP_TASK_IDS` (17 tasks)
- `CLOUD_VERSION`, `CLOUD_CODENAME`

---

## services

**Purpose:** Root composition and cross-cutting wiring.

**Exports:**
- `CloudServiceContainer` — full service map
- `CloudRuntimeContext` — immutable runtime metadata
- `ICloudEventBus` — async event publish/subscribe
- `CLOUD_EVENT_TOPICS` — 12 topic constants
- `IStartable`, `IStartableRegistry` — lifecycle management

---

## agents

**Purpose:** Agent fleet management.

**Key:** `IAgentService` with `register()`, `processHeartbeat()`, `sendCommand()`, `listOffline()`

**Constants:** `DEFAULT_AGENT_HEALTH_THRESHOLDS`

---

## audit

**Purpose:** Immutable compliance log.

**Key:** `IAuditService` with `log()`, `query()`, `export()`, `getStats()`

**Enumerations:** 22 `AuditAction` values, 13 `AuditResource` values, 3 `AuditOutcome` values

---

## configuration

**Purpose:** Config distribution and feature flags.

**Key:** `IConfigurationService.set/get/push`, `IFeatureFlagService.evaluate/set`

---

## health

**Purpose:** /health endpoint with pluggable checks.

**Key:** `IHealthMonitor` + `HealthCheck` plugin interface

**Constants:** `HEALTH_CHECK_IDS` (7 checks)

---

## jobs

**Purpose:** Async job engine with retry and history.

**Key:** `IJobEngine.enqueue/cancel/retry/registerHandler/startProcessing`

**Constants:** `JOB_KINDS` (8 built-in kinds)

---

## licenses

**Purpose:** Feature gating and capacity enforcement.

**Key:** `ILicenseService.activate/revoke/validateFeature/validateAgentLimit`

**Constants:** `TIER_FEATURES`, `TIER_LIMITS`

---

## metrics

**Purpose:** Time-series metrics with aggregation queries.

**Key:** `IMetricsService.record/query/getSummary/getAgentMetrics`

**Constants:** `METRIC_NAMES` (11 metric name constants)

---

## monitoring

**Purpose:** Agent fleet status and alerting.

**Key:** `IMonitoringService.getFleetStatus/createAlert/acknowledgeAlert`

---

## notifications

**Purpose:** Multi-channel notifications.

**Key:** `INotificationService.send/sendBatch/markAsRead/registerWebhook`

**Constants:** `NOTIFICATION_TEMPLATES` (9 templates)

---

## organizations

**Purpose:** Org lifecycle and member invitations.

**Key:** `IOrganizationService`, `IMemberService.invite/acceptInvite/updateRole`

---

## plugins

**Purpose:** Plugin registry, publishing, and org installs.

**Key:** `IPluginRegistryService.publish/install/uninstall/validateManifest`

---

## scheduler

**Purpose:** Cloud-side cron/interval job scheduling.

**Key:** `ICloudScheduler.define/trigger/startAll/stopAll`

**Constants:** `CLOUD_JOB_IDS` (10 built-in jobs)

---

## security

**Purpose:** Authentication, authorization, API keys, rate limiting.

**Key:** `IAuthenticationService.authenticate/verifyJWT/validateApiKey`, `IAuthorizationService.checkRole`, `IApiKeyService.generate/validate`, `IRateLimitService`

**Constants:** `SECURITY_HEADERS`, `JWT_CONFIG`, `ROLE_HIERARCHY`

---

## storage

**Purpose:** Blob/file storage for uploads and exports.

**Key:** `IStorageService.upload/download/getSignedUrl/getUsage`

**Constants:** `STORAGE_LIMITS`

---

## telemetry

**Purpose:** Structured logging, distributed tracing, agent telemetry ingestion.

**Key:** `CloudLogger`, `CloudTracer`, `CloudMetrics`, `IAgentTelemetryIngestion`

**Constants:** `CLOUD_METRICS` (15 metric names)

---

## users

**Purpose:** User profile management synced from Supabase Auth.

**Key:** `IUserService.upsertFromAuth/updateProfile/getOrganizations`

---

## tests

**Purpose:** Test infrastructure (dev/test only).

**Key:** `buildOrganization/buildWorkspace/buildEnvironment/buildAgent/buildUser`

**Fixtures:** `TEST_ORG_ID`, `TEST_WORKSPACE_ID`, `TEST_ENV_ID`, `TEST_AGENT_ID`, `TEST_USER_ID`
