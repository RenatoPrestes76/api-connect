# Module Documentation

Complete reference for all 21 governance modules.

---

## 1. policies/

**Foundation module.** Defines the policy engine contracts and the shared `GovernanceResult<T>` type used by every other module.

### Key Exports

| Export                | Description                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| `GovernanceResult<T>` | `{ ok: true; value: T } \| { ok: false; error: GovernanceError }`                   |
| `GovernanceError`     | `{ code: GovernanceErrorCode; message: string; details?: unknown }`                 |
| `IPolicyEngine`       | `evaluate / enforce / evaluateBatch / findApplicable`                               |
| `IPolicyRepository`   | `findById / findByScope / save / delete / listVersions / restoreVersion`            |
| `IPolicyAdminService` | `create / update / enable / disable / delete / test / import / export`              |
| `Policy`              | Full policy definition with `rules[]`, `scope`, `conflictResolution`                |
| `PolicyRule`          | Rule with `subjects[]`, `resources[]`, `actions[]`, `conditions[]`, `obligations[]` |
| `BUILT_IN_POLICIES`   | 8 named built-in policy IDs                                                         |

### Policy Evaluation Result

| Decision         | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `allow`          | At least one rule allows and no deny overrides |
| `deny`           | At least one deny rule matched                 |
| `not-applicable` | No applicable policies found                   |
| `indeterminate`  | Evaluation error; treat as deny                |

---

## 2. rbac/

Role-Based Access Control. Roles, permissions, claims, scopes, and context resolution.

### Key Exports

| Export                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `PLATFORM_ROLES`       | 19 named role IDs (constant)                                 |
| `PLATFORM_PERMISSIONS` | 38 named permission keys (constant)                          |
| `API_SCOPES`           | 21 OAuth2-style API scope definitions                        |
| `IRBACService`         | `resolveContext / checkPermission / assignRole / revokeRole` |
| `IRoleAdminService`    | `create / update / delete / cloneRole`                       |
| `IClaimsProvider`      | `extractClaims / validateClaim / enrichClaims`               |
| `RBACContext`          | Resolved subject context: roles, permissions, scopes, claims |
| `RoleAssignment`       | Assignment record with scope (org/workspace/env) and expiry  |

### Platform Roles (sample)

| Role ID                | Display Name                 |
| ---------------------- | ---------------------------- |
| `PLATFORM_SUPER_ADMIN` | Platform Super Administrator |
| `ORG_OWNER`            | Organization Owner           |
| `ORG_ADMIN`            | Organization Administrator   |
| `DEVELOPER`            | Developer                    |
| `SECURITY_ADMIN`       | Security Administrator       |
| `COMPLIANCE_OFFICER`   | Compliance Officer           |
| `RELEASE_MANAGER`      | Release Manager              |
| `AGENT_OPERATOR`       | Agent Operator               |
| `READONLY`             | Read Only                    |

---

## 3. permissions/

Permission registry and guard.

### Key Exports

| Export                | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `IPermissionRegistry` | `findByKey / listByCategory / resolve / buildMatrix / register / expand` |
| `IPermissionGuard`    | `assert / check / checkAll / checkAny`                                   |
| `PERMISSION_SETS`     | 6 named permission sets                                                  |

### Permission Sets

| Set                  | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `READ_ONLY`          | View-only access across all resources      |
| `DEVELOPER`          | Full development permissions without admin |
| `OPERATOR`           | Infrastructure and agent management        |
| `SECURITY_ADMIN`     | Security policy and RBAC management        |
| `COMPLIANCE_OFFICER` | Compliance assessments and reporting       |
| `RELEASE_MANAGER`    | Release pipeline management                |

---

## 4. organizations/

Org-level governance: membership rules, tier enforcement, security profiles.

### Key Exports

| Export                  | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `IOrgGovernanceService` | `getPolicy / setPolicy / evaluateMembershipRules / enforceTierLimits` |
| `OrgGovernancePolicy`   | Full org governance configuration                                     |
| `MembershipRule`        | Domain/email allow-list, auto-role assignment, MFA/SSO requirements   |
| `TierRule`              | Limits per tier (FREE/STARTER/PRO/ENTERPRISE)                         |
| `OrgSecurityProfile`    | MFA, SSO, session timeout, API key policies                           |
| `RetentionPolicy`       | Audit/metrics/notification/backup retention days                      |

---

## 5. workspaces/

Workspace isolation levels and environment promotion gates.

### Key Exports

| Export                        | Description                                                          |
| ----------------------------- | -------------------------------------------------------------------- |
| `IWorkspaceGovernanceService` | `getPolicy / setPolicy / evaluatePromotionGate / listPromotionGates` |
| `WorkspaceIsolationLevel`     | `shared \| isolated \| dedicated`                                    |
| `PromotionGate`               | Gates between environments with required checks                      |
| `PromotionCheck`              | Individual check: health/test/compliance/manual/policy               |

---

## 6. environments/

Environment tiers, change windows, lockdowns, access restrictions.

### Key Exports

| Export                          | Description                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `IEnvironmentGovernanceService` | `getPolicy / lockEnvironment / unlockEnvironment / isChangeAllowed / freezeChangeWindow` |
| `EnvironmentTier`               | `development \| staging \| qa \| uat \| production \| dr`                                |
| `ChangeWindowStatus`            | `open \| closed \| restricted \| emergency-only`                                         |
| `EnvironmentLockdown`           | Lock state with auto-unlock and allowed actions                                          |
| `ChangeWindow`                  | Schedule (days/hours/timezone), approval requirements                                    |

---

## 7. clusters/

Agent cluster registration and scheduling governance.

### Key Exports

| Export                      | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `IClusterGovernanceService` | `register / retire / setMaintenanceMode / enforcePolicy`  |
| `ClusterType`               | `single \| ha \| geo-distributed \| edge`                 |
| `ClusterStatus`             | `pending \| active \| degraded \| maintenance \| retired` |
| `SchedulingPolicy`          | `round-robin / least-loaded / affinity / manual`          |
| `ClusterNetworkPolicy`      | Ingress/egress CIDRs, mTLS, encryption                    |

---

## 8. nodes/

Node lifecycle: registration, health conditions, drain, evict.

### Key Exports

| Export                   | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `INodeGovernanceService` | `register / deregister / drain / evict / applyTaint / removeTaint`               |
| `NodeStatus`             | `registering \| ready \| not-ready \| draining \| drained \| evicted \| retired` |
| `NodeCondition`          | `Ready / MemoryPressure / DiskPressure / NetworkUnavailable / PIDPressure`       |
| `NodeTaint`              | Scheduling taints with `no-schedule / prefer-no-schedule / no-execute` effect    |

---

## 9. approval/

Multi-stage approval workflow engine.

### Key Exports

| Export                     | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| `IApprovalWorkflowService` | `request / decide / delegate / withdraw / escalate / requiresApproval` |
| `ApprovalPolicy`           | `stages[]`, `conflictOfInterest`, escalation rules                     |
| `ApprovalRequest`          | Full approval record with stage states and decisions                   |
| `ApprovalStage`            | `ApproverSelector` (role/user-list/group/owner/manager) + timeout      |
| `EscalationPolicy`         | Auto-escalate after N minutes                                          |
| `ApprovalUrgency`          | `low \| normal \| high \| critical \| emergency`                       |

---

## 10. change-management/

ITIL-style change request lifecycle.

### Key Exports

| Export                     | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `IChangeManagementService` | Full CR lifecycle: create → submit → approve → implement → complete / rollback |
| `ChangeRequest`            | Full CR record with impact, rollback plan, implementation steps                |
| `DeploymentPlan`           | Strategies: rolling/blue-green/canary/all-at-once/shadow/feature-flag          |
| `ChangeType`               | `standard \| normal \| emergency \| automated`                                 |
| `ChangeHistoryEvent`       | Append-only history events per CR                                              |

---

## 11. audit/

Immutable audit ledger with tamper detection.

### Key Exports

| Export                    | Description                                                             |
| ------------------------- | ----------------------------------------------------------------------- |
| `IGovernanceAuditService` | `log / query / verifyChain / export / getComplianceEvidence / getStats` |
| `GovernanceAuditEntry`    | Hash-chained entry with SHA-256 proof, policy trace, change context     |
| `AuditChain`              | Grouped chain with integrity status                                     |
| `GovernanceAuditAction`   | 34+ typed actions + `string` for extensibility                          |
| `DataSensitivity`         | `public \| internal \| confidential \| restricted`                      |
| `AuditExport`             | Format: `json \| csv \| jsonl \| pdf-report`                            |

---

## 12. compliance/

Multi-framework compliance: LGPD, ISO 27001, SOC 2, NIST CSF.

### Key Exports

| Export                        | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `IComplianceService`          | Assessments, findings, LGPD requests, programs, reports |
| `ComplianceFramework`         | `LGPD \| ISO27001 \| SOC2 \| NIST-CSF`                  |
| `ComplianceAssessment`        | Score 0–100, criticalGaps, certificationReady           |
| `LGPDDataSubjectRequest`      | 8 LGPD rights (Art. 18), 15-day response deadline       |
| `ISO27001_CONTROL_CATEGORIES` | 14 domains (A.5–A.18)                                   |
| `SOC2_COMMON_CRITERIA`        | 9 Common Criteria (CC1–CC9)                             |
| `NIST_CATEGORIES`             | 5 functions × subcategories                             |

---

## 13. configuration/

Scoped governance configuration with version history.

### Key Exports

| Export                     | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `IGovernanceConfigService` | `get / getAll / set / delete / getResolved / getHistory / rollback` |
| `ConfigScope`              | `platform \| organization \| workspace \| environment`              |
| `GovernanceConfigEntry`    | Versioned config with schema, encryption, source tracking           |
| `ConfigSchema`             | Validation rules: min/max, pattern, allowedValues                   |

---

## 14. feature-management/

Platform feature flags with rule-based targeting and experiments.

### Key Exports

| Export                      | Description                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| `IFeatureManagementService` | `evaluate / evaluateAll / create / update / enable / disable / createExperiment` |
| `FlagLifecycle`             | `permanent \| release \| experiment \| kill-switch \| ops`                       |
| `FlagRule`                  | Targeting conditions with rollout percentage                                     |
| `FlagConditionOperator`     | 13 operators (eq, in, contains, matches, gt, gte…)                               |
| `Experiment`                | A/B variants with allocation percentages                                         |

---

## 15. package-registry/

Plugin package submission, review, approval pipeline.

### Key Exports

| Export                    | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `IPackageRegistryService` | `submitPackage / assignReviewer / submitReview / publishSubmission / suspendPackage` |
| `PackageSubmission`       | Version submission with validation score, reviews, status lifecycle                  |
| `PackageReview`           | Role-based review (technical/security/compliance/editorial) with checklist           |
| `RegistryPolicy`          | Min validation score, required reviewer roles, quarantine period                     |
| `DEFAULT_REGISTRY_POLICY` | Baseline: 80 score, technical+security reviews required                              |

---

## 16. release-management/

Release lifecycle governance.

### Key Exports

| Export                      | Description                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| `IReleaseManagementService` | `create / createPlan / evaluateGate / promote / rollback / cancel`              |
| `Release`                   | Full release record with components, gates, promotion history                   |
| `ReleaseGate`               | 8 gate types: automated-test, security-scan, manual-approval, compliance-check… |
| `DeploymentStrategy`        | `rolling \| blue-green \| canary \| all-at-once \| shadow \| feature-flag`      |
| `ReleaseChannel`            | `internal \| beta \| stable \| lts`                                             |

---

## 17. backup/

Backup policy and job governance.

### Key Exports

| Export                     | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `IBackupGovernanceService` | `createPolicy / triggerBackup / verifyBackup / getComplianceStatus` |
| `BackupPolicy`             | Schedule, retention, encryption, targets                            |
| `BackupRetention`          | keep-last, daily/weekly/monthly/yearly retention windows            |
| `BackupFrequency`          | `hourly \| daily \| weekly \| monthly \| continuous`                |
| `BackupEncryption`         | `none \| aes-256 \| customer-managed`                               |

---

## 18. recovery/

Disaster Recovery plan governance.

### Key Exports

| Export                 | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `IDRGovernanceService` | `createPlan / approvePlan / createRecoveryPoint / scheduleDRTest / getDRStatus` |
| `RecoveryPlan`         | Phased recovery procedure with RTO/RPO objectives                               |
| `RecoveryObjectives`   | RPO/RTO hours, MTPD, `DRTier` (1–4)                                             |
| `RecoveryScenario`     | 7 scenarios: data-corruption, regional-outage, ransomware…                      |
| `DRTest`               | Test record with actual RTO/RPO vs. objectives                                  |

---

## 19. version-catalog/

Component version tracking and compatibility matrix.

### Key Exports

| Export                   | Description                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `IVersionCatalogService` | `publishVersion / getLatest / checkCompatibility / deprecate / getUpdateAvailable` |
| `PlatformComponent`      | 8 components: atlas-cloud/agent/runtime/sdk/plugin-sdk/cli/generator/governance    |
| `ComponentVersion`       | `CompatibilityMatrix` with semver ranges per component                             |
| `VersionStatus`          | `alpha \| beta \| rc \| stable \| lts \| deprecated \| eol`                        |
| `UpdateAvailableReport`  | Per-org update status with urgency levels                                          |

---

## 20. secret-management/

Secret vault with rotation policies and zero-trust access.

### Key Exports

| Export                      | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `ISecretManager`            | `create / access / rotate / markCompromised / delete / list / processExpiringSecrets` |
| `SecretKind`                | 11 types: api-key, password, certificate, private-key, connection-string…             |
| `SecretConsumer`            | Allowed consumers with permission types (read/rotate/delete)                          |
| `RotationPolicy`            | Interval, auto-rotate, version retention, require-approval                            |
| `DEFAULT_ROTATION_POLICIES` | Pre-configured rotation defaults per `SecretKind`                                     |

---

## 21. tenant-isolation/

Cross-tenant boundary enforcement.

### Key Exports

| Export                    | Description                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| `ITenantIsolationService` | `getBoundary / setBoundary / enforce / recordViolation / grantCrossTenantAccess` |
| `IsolationLevel`          | `shared \| pooled \| siloed \| dedicated`                                        |
| `TenantBoundary`          | Full isolation config: data residency, network policy, quotas, encryption        |
| `IsolationViolation`      | 6 violation types: cross-tenant-data-access, network-boundary-breach…            |
| `CrossTenantRule`         | Explicit grant for cross-org actions (with approval and expiry)                  |
| `TenantResourceQuotas`    | API rate limits, storage, concurrent connections per tenant                      |
