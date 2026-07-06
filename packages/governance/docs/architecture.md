# Governance Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Atlas Platform                                    │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ apps/cloud   │  │ apps/agent   │  │ apps/runtime │  │  apps/dev  │  │
│  │  (Next.js)   │  │  (Node.js)   │  │  (Node.js)   │  │  portal    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                 │          │
│  ┌──────▼─────────────────▼─────────────────▼─────────────────▼──────┐  │
│  │               @seltriva/governance (this package)                  │  │
│  │                  GOVERNANCE CONTRACTS LAYER                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
                        ┌─────────────┐
                        │  policies/  │  ◄── Foundation
                        │ GovernanceResult │
                        │ IPolicyEngine   │
                        └──────┬──────┘
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌──────────┐   ┌──────────────┐  ┌─────────────┐
        │  rbac/   │   │ permissions/ │  │ compliance/ │
        │ Roles    │   │ PermMatrix   │  │ LGPD/ISO/   │
        │ Claims   │   │ IPermGuard   │  │ SOC2/NIST   │
        └────┬─────┘   └──────────────┘  └─────────────┘
             │
  ┌──────────┼────────────────────────────────────────┐
  ▼          ▼           ▼           ▼                ▼
orgs/  workspaces/  envs/    clusters/  approval/
       ▼                        ▼
  feature-   audit/      change-mgmt/
  management             ▼
                    release-mgmt/
                    package-reg/
  secret-mgmt/  tenant-isolation/
  backup/  recovery/
  version-catalog/  configuration/
```

## Policy Evaluation Flow

```
Incoming Action
      │
      ▼
┌─────────────────────────────────────────────────────┐
│                 IPolicyEngine.evaluate()              │
│                                                       │
│  1. Build PolicyEvaluationRequest                     │
│     ┌─────────────────────────────────────────────┐  │
│     │ subject  → who (userId, roles[], claims[])   │  │
│     │ resource → what (type, id, org, workspace)   │  │
│     │ action   → verb (create, read, delete...)    │  │
│     │ context  → when/where (IP, time, requestId)  │  │
│     └─────────────────────────────────────────────┘  │
│                                                       │
│  2. Find applicable policies (IPolicyRepository)      │
│     └─> Match by scope (org, workspace, env, global) │
│                                                       │
│  3. Evaluate each policy's rules                      │
│     ├─> Check subject conditions                      │
│     ├─> Check resource conditions                     │
│     ├─> Evaluate ConditionOperators (14 operators)    │
│     └─> Apply ConflictResolution strategy             │
│         ├─ deny-overrides  (any deny wins)            │
│         ├─ allow-overrides (any allow wins)           │
│         ├─ first-applicable (first match wins)        │
│         └─ only-one (exactly one must match)          │
│                                                       │
│  4. Return PolicyEvaluationResult                     │
│     ┌─────────────────────────────────────────────┐  │
│     │ decision:     allow | deny | not-applicable  │  │
│     │ obligations:  PolicyObligation[] (side-fx)   │  │
│     │ matchedRules: PolicyRule[]                   │  │
│     └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
      │
      ▼
 Execute obligations (before/after)
      │
      ▼
 Log to GovernanceAuditService (chain-of-custody)
```

## RBAC Resolution Flow

```
Request → IRBACService.resolveContext(subjectId)
                │
                ▼
         ┌─────────────┐
         │ RBACContext  │
         │ roles[]      │  ◄── Direct + inherited roles
         │ permissions[]│  ◄── Expanded from all roles
         │ scopes[]     │  ◄── API scopes
         │ claims[]     │  ◄── From IClaimsProvider
         └──────┬───────┘
                │
     ┌──────────▼──────────┐
     │ IPermissionGuard     │
     │ .check(ctx, key)     │
     │   - key = "res:act"  │
     │   - PLATFORM_PERMISSIONS lookup
     │   - returns boolean  │
     │                      │
     │ .assert(ctx, key)    │
     │   - throws FORBIDDEN │
     │   if check fails     │
     └──────────────────────┘
```

## Change Management & Approval Flow

```
Developer/Operator
      │ wants to deploy to PRODUCTION
      ▼
┌─────────────────────────────────────────┐
│  1. IChangeManagementService.create()   │
│     ChangeRequest { type: 'normal',     │
│                     risk: 'high',       │
│                     category: 'deploy' }│
└─────────────────┬───────────────────────┘
                  │ .submit()
                  ▼
┌─────────────────────────────────────────┐
│  2. IApprovalWorkflowService.request()  │
│     ApprovalRequest { stages: [         │
│       { role: 'tech-lead',  count: 1 }, │
│       { role: 'release-mgr', count: 1 },│
│       { role: 'sec-officer', count: 1 } │
│     ]}                                  │
└─────────────────┬───────────────────────┘
                  │ all stages approved
                  ▼
┌─────────────────────────────────────────┐
│  3. IEnvironmentGovernanceService       │
│     .isChangeAllowed(envId, action)     │
│     ├── changeWindow.status === 'open'  │
│     └── lockdown.locked === false       │
└─────────────────┬───────────────────────┘
                  │ allowed
                  ▼
┌─────────────────────────────────────────┐
│  4. IChangeManagementService            │
│     .startImplementation() → EXECUTING  │
│     DeploymentPlan { strategy: 'rolling'│
│       phases, successCriteria }         │
└─────────────────┬───────────────────────┘
                  │ .complete()
                  ▼
         GovernanceAuditService.log()
```

## Audit Chain Architecture

```
Every governance event:
   ─────────────────────────────────────
   │ id       │ GovernanceAuditId       │
   │ chainId  │ AuditChainId            │
   │ sequence │ monotonic counter       │
   │ hash     │ SHA-256(prev + content) │  ◄── Tamper detection
   │ prev     │ previous hash           │
   │ actor    │ { id, type, email }     │
   │ action   │ GovernanceAuditAction   │
   │ resource │ { type, id, org }       │
   │ outcome  │ success|failure|denied  │
   │ policy   │ evaluation trace        │
   └─────────────────────────────────────

Chain verification: hash[N] = SHA-256(hash[N-1] + canonical(entry[N]))
```

## Tenant Isolation Architecture

```
Organization A                    Organization B
      │                                  │
      ▼                                  ▼
┌─────────────┐                 ┌─────────────┐
│  Tenant     │                 │  Tenant     │
│  Boundary A │                 │  Boundary B │
│  ──────────  │    BLOCKED      │  ──────────  │
│  RLS rules  │ ◄─── by ─────── │             │
│  API scopes │  ITenantIsolation│             │
│  Network    │  .enforce()     │             │
└─────────────┘                 └─────────────┘
       │                               │
       │  CrossTenantRule (explicit)    │
       └───────────────────────────────┘
          can unlock specific actions
```

## Compliance Architecture

```
Compliance Program (per org, per framework)
         │
         ▼
┌────────────────────────────────────────────────────┐
│              Compliance Frameworks                  │
│                                                     │
│  LGPD          ISO 27001       SOC 2    NIST CSF   │
│  ──────        ─────────       ─────    ────────   │
│  Art 7-18      A.5–A.18        CC1–CC9  5 functions│
│  Legal basis   93 controls     TSC      23 categories│
│  Data rights   ISMS            Type I/II subcategories│
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
           ComplianceAssessment
                     │
           ComplianceFinding[]
                     │
           evidence[] + gaps[]
                     │
           RemediationPlan
                     │
           ComplianceCertification
```

## Version Compatibility Matrix

```
           ┌─────────────────────────────────────────────┐
           │         Compatibility Matrix                  │
           │  cloud:  ">=0.1.0 <2.0.0"                    │
           │  agent:  ">=0.1.0 <2.0.0"                    │
           │  runtime: ">=0.1.0 <2.0.0"                   │
           │  sdk:    ">=0.1.0 <2.0.0"                    │
           └──────────────┬──────────────────────────────┘
                          │ checked by
                          ▼
              IVersionCatalogService
                .checkCompatibility()
                          │
                          ▼
              CompatibilityCheckResult
                .issues[]     // warnings/errors
                .compatible   // boolean
```
