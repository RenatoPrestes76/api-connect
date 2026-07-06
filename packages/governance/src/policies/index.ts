/**
 * @seltriva/governance — policies
 *
 * Policy Engine: the foundation of enterprise governance.
 * Every access decision, change, approval, and compliance check
 * is evaluated against a policy. No hardcoded rules anywhere.
 *
 * Policy evaluation order:
 *   1. Collect applicable policies (by subject + resource + action)
 *   2. Evaluate conditions for each policy
 *   3. Apply conflict resolution (deny-overrides by default)
 *   4. Return PolicyDecision with audit trail
 */

// ─── Branded Types ─────────────────────────────────────────────────────────

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type PolicyId     = Branded<string, 'PolicyId'>;
export type PolicySetId  = Branded<string, 'PolicySetId'>;
export type RuleId       = Branded<string, 'RuleId'>;

// ─── Policy Effect ──────────────────────────────────────────────────────────

export type PolicyEffect      = 'allow' | 'deny';
export type ConflictResolution = 'deny-overrides' | 'allow-overrides' | 'first-applicable' | 'only-one';
export type PolicyDecision    = 'allow' | 'deny' | 'not-applicable' | 'indeterminate';
export type ObligationKind    = 'before' | 'after';

// ─── Policy Subject ─────────────────────────────────────────────────────────

export interface PolicySubject {
  readonly id: string;
  readonly type: SubjectType;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly roles: string[];
  readonly claims: PolicyClaim[];
  readonly attributes?: Record<string, unknown>;
}

export type SubjectType = 'user' | 'api-key' | 'agent' | 'service' | 'system';

export interface PolicyClaim {
  readonly key: string;
  readonly value: unknown;
  readonly type: ClaimType;
  readonly issuer?: string;
  readonly expiresAt?: Date;
}

export type ClaimType = 'role' | 'attribute' | 'permission' | 'scope' | 'environment' | 'custom';

// ─── Policy Resource ────────────────────────────────────────────────────────

export interface PolicyResource {
  readonly type: ResourceType;
  readonly id?: string;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly attributes?: Record<string, unknown>;
}

export type ResourceType =
  | 'organization'
  | 'workspace'
  | 'environment'
  | 'cluster'
  | 'node'
  | 'agent'
  | 'plugin'
  | 'connector'
  | 'configuration'
  | 'secret'
  | 'feature-flag'
  | 'package'
  | 'release'
  | 'backup'
  | 'audit-log'
  | 'compliance-report'
  | 'change-request'
  | 'approval'
  | 'policy'
  | 'role'
  | 'user'
  | 'api-key'
  | '*';

// ─── Policy Context ─────────────────────────────────────────────────────────

export interface PolicyContext {
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly environment?: string;
  readonly timestamp: Date;
  readonly attributes?: Record<string, unknown>;
}

// ─── Policy Condition ───────────────────────────────────────────────────────

export interface PolicyCondition {
  readonly attribute: string;            // Attribute path (e.g. "subject.roles", "resource.environmentId")
  readonly operator: ConditionOperator;
  readonly value: unknown;
  readonly negate?: boolean;
}

export type ConditionOperator =
  | 'eq'          // equal
  | 'neq'         // not equal
  | 'in'          // value in array
  | 'not-in'      // value not in array
  | 'contains'    // array contains value
  | 'starts-with' // string starts with
  | 'ends-with'   // string ends with
  | 'matches'     // regex match
  | 'gt'          // greater than
  | 'gte'         // greater than or equal
  | 'lt'          // less than
  | 'lte'         // less than or equal
  | 'exists'      // attribute exists
  | 'not-exists'; // attribute does not exist

// ─── Policy Obligation ──────────────────────────────────────────────────────

export interface PolicyObligation {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly action: string;
  readonly parameters?: Record<string, unknown>;
}

// ─── Policy Rule ────────────────────────────────────────────────────────────

export interface PolicyRule {
  readonly id: RuleId;
  readonly name: string;
  readonly description?: string;
  readonly effect: PolicyEffect;
  readonly subjects?: PolicyCondition[];      // conditions on the subject
  readonly resources?: PolicyCondition[];     // conditions on the resource
  readonly actions?: string[];                // specific actions this rule covers ('*' = all)
  readonly conditions?: PolicyCondition[];    // environmental/contextual conditions
  readonly obligations?: PolicyObligation[];
  readonly priority?: number;                 // higher = evaluated first (default: 0)
}

// ─── Policy ─────────────────────────────────────────────────────────────────

export interface Policy {
  readonly id: PolicyId;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly scope: PolicyScope;
  readonly conflictResolution: ConflictResolution;
  readonly rules: PolicyRule[];
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
}

export interface PolicyScope {
  readonly organizationId?: string;           // null = platform-wide
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly resourceTypes?: ResourceType[];     // empty = all resources
}

// ─── Policy Set ─────────────────────────────────────────────────────────────

export interface PolicySet {
  readonly id: PolicySetId;
  readonly name: string;
  readonly description?: string;
  readonly policies: PolicyId[];
  readonly conflictResolution: ConflictResolution;
  readonly enabled: boolean;
}

// ─── Evaluation Request / Response ──────────────────────────────────────────

export interface PolicyEvaluationRequest {
  readonly requestId?: string;
  readonly subject: PolicySubject;
  readonly resource: PolicyResource;
  readonly action: string;
  readonly context: PolicyContext;
}

export interface PolicyEvaluationResult {
  readonly requestId?: string;
  readonly decision: PolicyDecision;
  readonly applicablePolicies: ApplicablePolicyResult[];
  readonly obligations: PolicyObligation[];
  readonly evaluatedAt: Date;
  readonly durationMs: number;
  readonly reason?: string;
}

export interface ApplicablePolicyResult {
  readonly policyId: PolicyId;
  readonly policyName: string;
  readonly ruleId?: RuleId;
  readonly decision: PolicyDecision;
  readonly matchedConditions: string[];
}

// ─── Policy Engine Interface ─────────────────────────────────────────────────

export interface IPolicyEngine {
  /**
   * Evaluate a single access decision.
   */
  evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult>;

  /**
   * Evaluate and throw GovernanceError if denied.
   */
  enforce(request: PolicyEvaluationRequest): Promise<void>;

  /**
   * Bulk evaluation (optimization for UI permission checks).
   */
  evaluateBatch(requests: PolicyEvaluationRequest[]): Promise<PolicyEvaluationResult[]>;

  /**
   * Find all policies applicable to a given scope.
   */
  findApplicable(scope: PolicyScope, action?: string): Promise<Policy[]>;
}

// ─── Policy Repository ───────────────────────────────────────────────────────

export interface IPolicyRepository {
  findById(id: PolicyId): Promise<Policy | null>;
  findByScope(scope: PolicyScope): Promise<Policy[]>;
  save(policy: Policy): Promise<void>;
  delete(id: PolicyId): Promise<void>;
  listVersions(id: PolicyId): Promise<PolicyVersion[]>;
  restoreVersion(id: PolicyId, version: string): Promise<Policy>;
}

export interface PolicyVersion {
  readonly policyId: PolicyId;
  readonly version: string;
  readonly snapshot: Policy;
  readonly createdAt: Date;
  readonly createdBy: string;
}

// ─── Policy Administration ──────────────────────────────────────────────────

export interface IPolicyAdminService {
  create(input: CreatePolicyInput): Promise<GovernanceResult<Policy>>;
  update(id: PolicyId, input: UpdatePolicyInput): Promise<GovernanceResult<Policy>>;
  enable(id: PolicyId): Promise<GovernanceResult<void>>;
  disable(id: PolicyId): Promise<GovernanceResult<void>>;
  delete(id: PolicyId): Promise<GovernanceResult<void>>;
  test(policy: Policy, request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult>;
  import(definition: unknown): Promise<GovernanceResult<Policy>>;
  export(id: PolicyId): Promise<unknown>;
}

export interface CreatePolicyInput {
  readonly name: string;
  readonly description?: string;
  readonly scope: PolicyScope;
  readonly conflictResolution?: ConflictResolution;
  readonly rules: Omit<PolicyRule, 'id'>[];
  readonly tags?: string[];
  readonly createdBy: string;
}

export interface UpdatePolicyInput {
  readonly name?: string;
  readonly description?: string;
  readonly rules?: Omit<PolicyRule, 'id'>[];
  readonly tags?: string[];
  readonly updatedBy: string;
}

// ─── Built-in Policy IDs ───────────────────────────────────────────────────

export const BUILT_IN_POLICIES = {
  DENY_ALL:                    'pol-builtin-deny-all',
  ALLOW_OWNER:                 'pol-builtin-allow-owner',
  REQUIRE_MFA_ADMIN:           'pol-builtin-require-mfa-admin',
  RESTRICT_PROD_WRITES:        'pol-builtin-restrict-prod-writes',
  AUDIT_ALL_MUTATIONS:         'pol-builtin-audit-all-mutations',
  REQUIRE_APPROVAL_RELEASE:    'pol-builtin-require-approval-release',
  ENFORCE_TENANT_ISOLATION:    'pol-builtin-tenant-isolation',
  RESTRICT_SECRETS_READ:       'pol-builtin-restrict-secrets-read',
} as const;

// ─── Governance Result ──────────────────────────────────────────────────────

export type GovernanceResult<T> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: GovernanceError };

export interface GovernanceError {
  readonly code: GovernanceErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export type GovernanceErrorCode =
  | 'POLICY_DENIED'
  | 'POLICY_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'QUOTA_EXCEEDED'
  | 'APPROVAL_REQUIRED'
  | 'CHANGE_FROZEN'
  | 'TENANT_VIOLATION'
  | 'COMPLIANCE_VIOLATION'
  | 'UNKNOWN';
