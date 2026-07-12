// ─── Secrets ─────────────────────────────────────────────────────────────────

export type SecretType =
  | 'connector_password'
  | 'api_key'
  | 'webhook_secret'
  | 'db_credential'
  | 'private_key'
  | 'oauth_token'
  | 'refresh_token'
  | 'vpn_credential'
  | 'certificate';

export type SecretProvider =
  | 'internal'
  | 'hashicorp_vault'
  | 'aws_secrets_manager'
  | 'azure_key_vault'
  | 'gcp_secret_manager';

export interface Secret {
  id: string;
  name: string;
  description: string;
  type: SecretType;
  provider: SecretProvider;
  /** Encrypted envelope JSON — never expose plaintext */
  encryptedValue: string;
  tenantId: string;
  version: number;
  rotatedAt: string;
  expiresAt: string | null;
  tags: string[];
  /** Sprint 47 (ATLAS FORTRESS): whether the rotation scheduler auto-rotates this secret. */
  autoRotate: boolean;
  /** Days between automatic rotations; required when autoRotate is true. */
  rotationIntervalDays: number | null;
  /** Sync status against the external provider named in `provider` (only meaningful when provider !== 'internal'). */
  vaultStatus: 'not_configured' | 'synced' | 'error' | null;
  vaultVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecretMetadata extends Omit<Secret, 'encryptedValue'> {
  masked: string;
}

// ─── MFA ─────────────────────────────────────────────────────────────────────

export interface MfaRecord {
  tenantId: string;
  userId: string;
  enrolled: boolean;
  secretBase32: string;
  backupCodes: string[];
  usedBackupCodes: string[];
  trustedDevices: TrustedDevice[];
  enrolledAt: string | null;
  lastUsedAt: string | null;
}

export interface TrustedDevice {
  id: string;
  name: string;
  userAgent: string;
  ip: string;
  trustedAt: string;
}

export interface MfaSetupResult {
  secret: string;
  otpUri: string;
  backupCodes: string[];
  qrData: string;
}

// ─── SSO ─────────────────────────────────────────────────────────────────────

export type SSOProtocol = 'oidc' | 'saml2' | 'oauth2';
export type SSOProviderSlug =
  | 'microsoft_entra'
  | 'google_workspace'
  | 'okta'
  | 'ping_identity'
  | 'generic_oidc'
  | 'saml_generic';

export interface SSOProvider {
  id: string;
  tenantId: string;
  name: string;
  slug: SSOProviderSlug;
  protocol: SSOProtocol;
  issuer: string;
  clientId: string;
  discoveryUrl: string | null;
  ssoUrl: string | null;
  logoutUrl: string | null;
  certificate: string | null;
  active: boolean;
  createdAt: string;
}

export interface SSOInitiateResult {
  redirectUrl: string;
  state: string;
  nonce: string;
  expiresAt: string;
}

// ─── Policies ────────────────────────────────────────────────────────────────

export type PolicyEffect = 'ALLOW' | 'DENY';
export type PolicyLogic = 'AND' | 'OR';
export type ConditionOperator = 'eq' | 'neq' | 'in' | 'notIn' | 'gt' | 'lt' | 'matches' | 'between';

export interface PolicyCondition {
  attribute: string;
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  logic: PolicyLogic;
  effect: PolicyEffect;
  priority: number;
  active: boolean;
  version: number;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyContext {
  role: string;
  department?: string;
  ip?: string;
  country?: string;
  device?: string;
  hour?: number;
  riskScore?: number;
  method?: string;
  [key: string]: string | number | undefined;
}

export type PolicyDecision = 'ALLOW' | 'DENY' | 'DEFAULT_DENY';

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'mfa_enrolled'
  | 'mfa_verified'
  | 'mfa_failed'
  | 'secret_created'
  | 'secret_accessed'
  | 'secret_rotated'
  | 'secret_deleted'
  | 'policy_created'
  | 'policy_updated'
  | 'policy_deleted'
  | 'workflow_created'
  | 'workflow_deleted'
  | 'connector_created'
  | 'connector_deleted'
  | 'plan_changed'
  | 'permission_changed'
  | 'sso_login'
  | 'sso_configured'
  | 'data_exported'
  | 'data_deleted'
  | 'key_rotated'
  | 'certificate_renewed'
  | 'admin_action';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actor: string;
  tenantId: string;
  resource: string;
  resourceId: string | null;
  ip: string;
  userAgent: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  sequence: number;
  hash: string;
  previousHash: string;
  event: AuditEvent;
  timestamp: string;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskType =
  | 'login_from_new_country'
  | 'repeated_auth_failure'
  | 'token_reuse'
  | 'privilege_escalation'
  | 'anomalous_behavior'
  | 'suspicious_ip'
  | 'bot_detected'
  | 'rate_limit_abuse';

export interface RiskEvent {
  id: string;
  type: RiskType;
  tenantId: string;
  actor: string;
  level: RiskLevel;
  score: number;
  description: string;
  ip: string;
  country: string | null;
  resolved: boolean;
  detectedAt: string;
}

export interface RiskScore {
  tenantId: string;
  score: number;
  level: RiskLevel;
  factors: string[];
  computedAt: string;
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export type CertUsage = 'tls' | 'mtls_client' | 'code_signing' | 'saml_signing' | 'agent_identity';

export interface Certificate {
  id: string;
  name: string;
  usage: CertUsage;
  tenantId: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  thumbprint: string;
  issuedAt: string;
  expiresAt: string;
  daysUntilExpiry: number;
  autoRenew: boolean;
  renewedAt: string | null;
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export type ComplianceFramework = 'LGPD' | 'GDPR' | 'SOC2' | 'ISO27001' | 'OWASP_ASVS';
export type ComplianceStatus = 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  control: string;
  description: string;
  status: ComplianceStatus;
  evidence: string;
  lastAssessedAt: string;
}

export type DataRequestType = 'access' | 'deletion' | 'export' | 'correction' | 'portability';
export type DataRequestStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface DataRequest {
  id: string;
  type: DataRequestType;
  tenantId: string;
  requestorEmail: string;
  framework: 'LGPD' | 'GDPR';
  status: DataRequestStatus;
  notes: string;
  requestedAt: string;
  completedAt: string | null;
  deadlineAt: string;
}

// ─── Consent ─────────────────────────────────────────────────────────────────

export type ConsentPurpose =
  | 'data_processing'
  | 'marketing'
  | 'analytics'
  | 'profiling'
  | 'third_party_sharing';

export interface ConsentRecord {
  id: string;
  tenantId: string;
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  framework: 'LGPD' | 'GDPR';
  source: string;
  ipAddress: string;
  version: string;
}

// ─── Security Dashboard ────────────────────────────────────────────────────────

export interface SecurityDashboard {
  eventsToday: number;
  failedAuthLast24h: number;
  suspiciousLogins: number;
  certsExpiringSoon: number;
  mfaAdoptionPct: number;
  activePolicies: number;
  riskEventsLast7d: number;
  compliance: Record<ComplianceFramework, ComplianceStatus>;
  criticalAlerts: string[];
  riskScores: RiskScore[];
}
