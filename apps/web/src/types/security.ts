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

export interface SecretMetadata {
  id: string;
  name: string;
  description: string;
  type: SecretType;
  provider: SecretProvider;
  tenantId: string;
  version: number;
  rotatedAt: string;
  expiresAt: string | null;
  tags: string[];
  masked: string;
  createdAt: string;
  updatedAt: string;
}

export interface MfaStatus {
  tenantId: string;
  userId: string;
  enrolled: boolean;
  trustedDevices: Array<{ id: string; name: string; trustedAt: string }>;
  enrolledAt: string | null;
  lastUsedAt: string | null;
  backupCodesRemaining: number;
}

export interface SSOProvider {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  protocol: 'oidc' | 'saml2' | 'oauth2';
  issuer: string;
  clientId: string;
  active: boolean;
  createdAt: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  conditions: Array<{ attribute: string; operator: string; value: unknown }>;
  logic: 'AND' | 'OR';
  effect: 'ALLOW' | 'DENY';
  priority: number;
  active: boolean;
  version: number;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PolicyDecision = 'ALLOW' | 'DENY' | 'DEFAULT_DENY';

export interface PolicyEvalResult {
  decision: PolicyDecision;
  matchedPolicy: { id: string; name: string; effect: string; priority: number } | null;
  evaluatedCount: number;
}

export interface AuditEntry {
  id: string;
  sequence: number;
  hash: string;
  previousHash: string;
  event: {
    id: string;
    action: string;
    actor: string;
    tenantId: string;
    resource: string;
    resourceId: string | null;
    ip: string;
    result: string;
    timestamp: string;
  };
  timestamp: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskEvent {
  id: string;
  type: string;
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

export interface Certificate {
  id: string;
  name: string;
  usage: string;
  subject: string;
  issuer: string;
  expiresAt: string;
  daysUntilExpiry: number;
  autoRenew: boolean;
  renewedAt: string | null;
}

export interface ComplianceControl {
  id: string;
  framework: string;
  control: string;
  description: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';
  evidence: string;
  lastAssessedAt: string;
}

export interface ConsentRecord {
  id: string;
  tenantId: string;
  userId: string;
  purpose: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  framework: 'LGPD' | 'GDPR';
  source: string;
  version: string;
}

export interface SecretsResponse {
  secrets: SecretMetadata[];
  total: number;
}

export interface SsoProvidersResponse {
  providers: SSOProvider[];
  total: number;
}

export interface PoliciesResponse {
  policies: Policy[];
  total: number;
}

export interface AuditEntriesResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChainVerificationResult {
  valid: boolean;
  invalidAt: number | null;
  total: number;
}

export interface RiskEventsResponse {
  events: RiskEvent[];
  total: number;
}

export interface CertificatesResponse {
  certificates: Certificate[];
  expiringSoon: number;
  total: number;
}

export interface ComplianceFrameworkSummary {
  framework: string;
  total: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
}

export interface ComplianceResponse {
  controls: ComplianceControl[];
  summary: ComplianceFrameworkSummary[];
  total: number;
}

export interface ConsentResponse {
  records: ConsentRecord[];
  total: number;
}

export interface SecurityDashboard {
  eventsToday: number;
  failedAuthLast24h: number;
  suspiciousLogins: number;
  certsExpiringSoon: number;
  mfaAdoptionPct: number;
  activePolicies: number;
  riskEventsLast7d: number;
  compliance: Record<string, 'compliant' | 'partial' | 'non_compliant' | 'not_assessed'>;
  criticalAlerts: string[];
  riskScores: RiskScore[];
}
