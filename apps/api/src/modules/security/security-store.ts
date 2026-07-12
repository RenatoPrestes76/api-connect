import {
  envelopeEncrypt,
  serializeEnvelope,
  generateTotpSecret,
  generateBackupCodes,
  appendEntry,
  vaultAdapter,
  type EncryptedEnvelope,
} from '@seltriva/aegis';
import type {
  Secret,
  SecretMetadata,
  MfaRecord,
  TrustedDevice,
  SSOProvider,
  Policy,
  AuditEntry,
  AuditEvent,
  RiskEvent,
  RiskScore,
  RiskLevel,
  Certificate,
  ComplianceControl,
  DataRequest,
  ConsentRecord,
  SecurityDashboard,
} from '@seltriva/aegis';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoNow(offsetDays = 0): string {
  const d = new Date('2026-07-10T12:00:00Z');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function encrypt(plaintext: string): string {
  return serializeEnvelope(envelopeEncrypt(plaintext));
}

function maskSecret(id: string): string {
  return `***${id.slice(-4).toUpperCase()}`;
}

// ─── SecurityStore ────────────────────────────────────────────────────────────

class SecurityStore {
  private secrets: Map<string, Secret> = new Map();
  private mfaRecords: Map<string, MfaRecord> = new Map(); // key: `${tenantId}:${userId}`
  private ssoProviders: Map<string, SSOProvider> = new Map();
  private policies: Map<string, Policy> = new Map();
  private auditChain: AuditEntry[] = [];
  private riskEvents: Map<string, RiskEvent> = new Map();
  private certificates: Map<string, Certificate> = new Map();
  private complianceControls: Map<string, ComplianceControl> = new Map();
  private dataRequests: Map<string, DataRequest> = new Map();
  private consentRecords: Map<string, ConsentRecord> = new Map();

  constructor() {
    this._seed();
  }

  private _seed(): void {
    this._seedSecrets();
    this._seedMfa();
    this._seedSso();
    this._seedPolicies();
    this._seedAuditChain();
    this._seedRiskEvents();
    this._seedCertificates();
    this._seedCompliance();
    this._seedConsent();
  }

  // ─── Secrets seeding ───────────────────────────────────────────────────────

  private _seedSecrets(): void {
    const seeds: Omit<Secret, 'encryptedValue'>[] = [
      {
        id: 'sec-001',
        name: 'ERP System Password',
        description: 'Main ERP connector credential',
        type: 'connector_password',
        provider: 'internal',
        tenantId: 'tenant-enterprise',
        version: 3,
        rotatedAt: isoNow(-7),
        expiresAt: isoNow(83),
        tags: ['erp', 'connector'],
        autoRotate: true,
        rotationIntervalDays: 90,
        vaultStatus: null,
        vaultVersion: null,
        createdAt: isoNow(-90),
        updatedAt: isoNow(-7),
      },
      {
        id: 'sec-002',
        name: 'PostgreSQL Main Password',
        description: 'Primary database credential',
        type: 'db_credential',
        provider: 'hashicorp_vault',
        tenantId: 'tenant-enterprise',
        version: 5,
        rotatedAt: isoNow(-2),
        expiresAt: isoNow(28),
        tags: ['database', 'postgresql'],
        autoRotate: true,
        rotationIntervalDays: 30,
        vaultStatus: 'not_configured',
        vaultVersion: null,
        createdAt: isoNow(-180),
        updatedAt: isoNow(-2),
      },
      {
        id: 'sec-003',
        name: 'OpenAI ML API Key',
        description: 'ML pipeline API key',
        type: 'api_key',
        provider: 'aws_secrets_manager',
        tenantId: 'tenant-enterprise',
        version: 2,
        rotatedAt: isoNow(-14),
        expiresAt: null,
        tags: ['ml', 'ai', 'openai'],
        autoRotate: false,
        rotationIntervalDays: null,
        vaultStatus: 'not_configured',
        vaultVersion: null,
        createdAt: isoNow(-60),
        updatedAt: isoNow(-14),
      },
      {
        id: 'sec-004',
        name: 'Slack Webhook URL',
        description: 'Notification webhook for #ops',
        type: 'webhook_secret',
        provider: 'internal',
        tenantId: 'tenant-professional',
        version: 1,
        rotatedAt: isoNow(-30),
        expiresAt: null,
        tags: ['slack', 'notification'],
        autoRotate: false,
        rotationIntervalDays: null,
        vaultStatus: null,
        vaultVersion: null,
        createdAt: isoNow(-30),
        updatedAt: isoNow(-30),
      },
      {
        id: 'sec-005',
        name: 'Redis Cache Password',
        description: 'Redis cluster auth token',
        type: 'db_credential',
        provider: 'azure_key_vault',
        tenantId: 'tenant-enterprise',
        version: 2,
        rotatedAt: isoNow(-45),
        expiresAt: isoNow(315),
        tags: ['redis', 'cache'],
        autoRotate: true,
        rotationIntervalDays: 365,
        vaultStatus: 'not_configured',
        vaultVersion: null,
        createdAt: isoNow(-120),
        updatedAt: isoNow(-45),
      },
      {
        id: 'sec-006',
        name: 'JWT Master Secret',
        description: 'Token signing key for auth service',
        type: 'private_key',
        provider: 'hashicorp_vault',
        tenantId: 'tenant-enterprise',
        version: 1,
        rotatedAt: isoNow(-180),
        expiresAt: isoNow(185),
        tags: ['jwt', 'auth', 'signing'],
        autoRotate: false,
        rotationIntervalDays: null,
        vaultStatus: 'not_configured',
        vaultVersion: null,
        createdAt: isoNow(-180),
        updatedAt: isoNow(-180),
      },
      {
        id: 'sec-007',
        name: 'Atlas Request Signing Key',
        description: 'HMAC key for internal API signing',
        type: 'private_key',
        provider: 'internal',
        tenantId: 'tenant-professional',
        version: 4,
        rotatedAt: isoNow(-3),
        expiresAt: isoNow(87),
        tags: ['atlas', 'signing', 'hmac'],
        autoRotate: true,
        rotationIntervalDays: 90,
        vaultStatus: null,
        vaultVersion: null,
        createdAt: isoNow(-365),
        updatedAt: isoNow(-3),
      },
    ];

    const plaintexts: Record<string, string> = {
      'sec-001': 'P@ssw0rd!ERP2026#Atlas',
      'sec-002': 'pg_s3cur3_p@ssw0rd!2026',
      'sec-003': 'sk-openai-demo-key-xxxxxxxxxxxxxxxxxxxx',
      'sec-004': 'https://hooks.slack.com/services/T00000/B00000/XXXX',
      'sec-005': 'redis_auth_t0k3n!2026',
      'sec-006': 'jwt-master-secret-do-not-expose-!!',
      'sec-007': 'atlas-hmac-signing-key-v4-production',
    };

    for (const seed of seeds) {
      const encryptedValue = encrypt(plaintexts[seed.id]!);
      this.secrets.set(seed.id, { ...seed, encryptedValue });
    }
  }

  // ─── MFA seeding ───────────────────────────────────────────────────────────

  private _seedMfa(): void {
    const enterpriseMfa: MfaRecord = {
      tenantId: 'tenant-enterprise',
      userId: 'admin@atlas.enterprise.com',
      enrolled: true,
      secretBase32: generateTotpSecret(),
      backupCodes: generateBackupCodes(8),
      usedBackupCodes: [],
      trustedDevices: [
        {
          id: 'dev-001',
          name: 'MacBook Pro',
          userAgent: 'Mozilla/5.0 (Macintosh)',
          ip: '192.168.1.10',
          trustedAt: isoNow(-30),
        },
        {
          id: 'dev-002',
          name: 'iPhone 15',
          userAgent: 'Mozilla/5.0 (iPhone)',
          ip: '192.168.1.11',
          trustedAt: isoNow(-15),
        },
      ],
      enrolledAt: isoNow(-90),
      lastUsedAt: isoNow(-1),
    };
    const professionalMfa: MfaRecord = {
      tenantId: 'tenant-professional',
      userId: 'user@atlas.professional.com',
      enrolled: true,
      secretBase32: generateTotpSecret(),
      backupCodes: generateBackupCodes(5),
      usedBackupCodes: [],
      trustedDevices: [],
      enrolledAt: isoNow(-45),
      lastUsedAt: isoNow(-5),
    };
    const communityMfa: MfaRecord = {
      tenantId: 'tenant-community',
      userId: 'dev@atlas.community.com',
      enrolled: false,
      secretBase32: '',
      backupCodes: [],
      usedBackupCodes: [],
      trustedDevices: [],
      enrolledAt: null,
      lastUsedAt: null,
    };
    for (const rec of [enterpriseMfa, professionalMfa, communityMfa]) {
      this.mfaRecords.set(`${rec.tenantId}:${rec.userId}`, rec);
    }
  }

  // ─── SSO seeding ───────────────────────────────────────────────────────────

  private _seedSso(): void {
    const providers: SSOProvider[] = [
      {
        id: 'sso-001',
        tenantId: 'tenant-enterprise',
        name: 'Microsoft Entra ID',
        slug: 'microsoft_entra',
        protocol: 'oidc',
        issuer: 'https://login.microsoftonline.com/demo-tenant-id/v2.0',
        clientId: 'azure-client-id-demo-enterprise',
        discoveryUrl:
          'https://login.microsoftonline.com/demo-tenant-id/v2.0/.well-known/openid-configuration',
        ssoUrl: null,
        logoutUrl: 'https://login.microsoftonline.com/demo-tenant-id/oauth2/v2.0/logout',
        certificate: null,
        active: true,
        createdAt: isoNow(-120),
      },
      {
        id: 'sso-002',
        tenantId: 'tenant-professional',
        name: 'Google Workspace',
        slug: 'google_workspace',
        protocol: 'oidc',
        issuer: 'https://accounts.google.com',
        clientId: 'google-client-id-demo-professional.apps.googleusercontent.com',
        discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
        ssoUrl: null,
        logoutUrl: 'https://accounts.google.com/o/oauth2/revoke',
        certificate: null,
        active: true,
        createdAt: isoNow(-60),
      },
      {
        id: 'sso-003',
        tenantId: 'tenant-enterprise',
        name: 'Okta Enterprise',
        slug: 'okta',
        protocol: 'saml2',
        issuer: 'https://atlas-demo.okta.com',
        clientId: '',
        discoveryUrl: null,
        ssoUrl: 'https://atlas-demo.okta.com/app/sso/saml',
        logoutUrl: 'https://atlas-demo.okta.com/app/sso/logout',
        certificate: 'MIICxDCCAaygAwIBAgIGAVAKHsgWMA0GCSq...', // truncated for demo
        active: false,
        createdAt: isoNow(-200),
      },
    ];
    for (const p of providers) this.ssoProviders.set(p.id, p);
  }

  // ─── Policies seeding ──────────────────────────────────────────────────────

  private _seedPolicies(): void {
    const policies: Policy[] = [
      {
        id: 'pol-001',
        name: 'ADMIN_ALLOW',
        description: 'Allow all actions for admin role',
        conditions: [{ attribute: 'role', operator: 'eq', value: 'admin' }],
        logic: 'AND',
        effect: 'ALLOW',
        priority: 100,
        active: true,
        version: 1,
        tenantId: null,
        createdAt: isoNow(-365),
        updatedAt: isoNow(-365),
      },
      {
        id: 'pol-002',
        name: 'BUSINESS_HOURS',
        description: 'Allow access only during business hours (9–18)',
        conditions: [{ attribute: 'hour', operator: 'between', value: [9, 18] }],
        logic: 'AND',
        effect: 'ALLOW',
        priority: 50,
        active: true,
        version: 2,
        tenantId: null,
        createdAt: isoNow(-180),
        updatedAt: isoNow(-30),
      },
      {
        id: 'pol-003',
        name: 'EXECUTIVE_APPROVAL',
        description: 'Require extra approval for executive resources',
        conditions: [
          { attribute: 'resource', operator: 'eq', value: 'executive_data' },
          { attribute: 'role', operator: 'neq', value: 'cto' },
        ],
        logic: 'AND',
        effect: 'DENY',
        priority: 80,
        active: true,
        version: 1,
        tenantId: 'tenant-enterprise',
        createdAt: isoNow(-90),
        updatedAt: isoNow(-90),
      },
      {
        id: 'pol-004',
        name: 'VIEWER_READONLY',
        description: 'Viewers may only perform read operations',
        conditions: [
          { attribute: 'role', operator: 'eq', value: 'viewer' },
          { attribute: 'method', operator: 'in', value: ['DELETE', 'POST', 'PUT', 'PATCH'] },
        ],
        logic: 'AND',
        effect: 'DENY',
        priority: 30,
        active: true,
        version: 1,
        tenantId: null,
        createdAt: isoNow(-270),
        updatedAt: isoNow(-270),
      },
      {
        id: 'pol-005',
        name: 'HIGH_RISK_DENY',
        description: 'Block access for high risk-score sessions',
        conditions: [{ attribute: 'riskScore', operator: 'gt', value: 75 }],
        logic: 'AND',
        effect: 'DENY',
        priority: 200,
        active: true,
        version: 3,
        tenantId: null,
        createdAt: isoNow(-365),
        updatedAt: isoNow(-7),
      },
    ];
    for (const p of policies) this.policies.set(p.id, p);
  }

  // ─── Audit chain seeding ──────────────────────────────────────────────────

  private _seedAuditChain(): void {
    const events: Omit<AuditEvent, 'id'>[] = [
      {
        action: 'login',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'auth',
        resourceId: null,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { method: 'password+mfa' },
        timestamp: isoNow(-29),
      },
      {
        action: 'secret_created',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'secrets',
        resourceId: 'sec-001',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { name: 'ERP System Password' },
        metadata: {},
        timestamp: isoNow(-28),
      },
      {
        action: 'policy_created',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'policies',
        resourceId: 'pol-001',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { name: 'ADMIN_ALLOW' },
        metadata: {},
        timestamp: isoNow(-27),
      },
      {
        action: 'mfa_enrolled',
        actor: 'user@atlas.professional.com',
        tenantId: 'tenant-professional',
        resource: 'mfa',
        resourceId: null,
        ip: '10.0.0.5',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { enrolled: true },
        metadata: {},
        timestamp: isoNow(-26),
      },
      {
        action: 'sso_configured',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'sso',
        resourceId: 'sso-001',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { provider: 'Microsoft Entra ID' },
        metadata: {},
        timestamp: isoNow(-25),
      },
      {
        action: 'login',
        actor: 'user@atlas.professional.com',
        tenantId: 'tenant-professional',
        resource: 'auth',
        resourceId: null,
        ip: '10.0.0.5',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { method: 'sso' },
        timestamp: isoNow(-20),
      },
      {
        action: 'secret_accessed',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'secrets',
        resourceId: 'sec-002',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { reason: 'connector-setup' },
        timestamp: isoNow(-19),
      },
      {
        action: 'workflow_created',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'workflows',
        resourceId: 'wf-001',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { name: 'ERP Sync' },
        metadata: {},
        timestamp: isoNow(-18),
      },
      {
        action: 'login_failed',
        actor: 'unknown@hacker.example.com',
        tenantId: 'tenant-enterprise',
        resource: 'auth',
        resourceId: null,
        ip: '5.5.5.5',
        userAgent: 'curl/7.81.0',
        before: null,
        after: null,
        metadata: { reason: 'invalid_password' },
        timestamp: isoNow(-15),
      },
      {
        action: 'login_failed',
        actor: 'unknown@hacker.example.com',
        tenantId: 'tenant-enterprise',
        resource: 'auth',
        resourceId: null,
        ip: '5.5.5.5',
        userAgent: 'curl/7.81.0',
        before: null,
        after: null,
        metadata: { reason: 'invalid_password' },
        timestamp: isoNow(-15),
      },
      {
        action: 'secret_rotated',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'secrets',
        resourceId: 'sec-007',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: { version: 3 },
        after: { version: 4 },
        metadata: {},
        timestamp: isoNow(-3),
      },
      {
        action: 'key_rotated',
        actor: 'system',
        tenantId: 'tenant-enterprise',
        resource: 'encryption',
        resourceId: 'master-key',
        ip: '127.0.0.1',
        userAgent: 'AtlasAgent/1.0',
        before: null,
        after: null,
        metadata: { scheduled: true },
        timestamp: isoNow(-3),
      },
      {
        action: 'policy_updated',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'policies',
        resourceId: 'pol-005',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: { version: 2 },
        after: { version: 3 },
        metadata: {},
        timestamp: isoNow(-7),
      },
      {
        action: 'plan_changed',
        actor: 'admin@atlas.professional.com',
        tenantId: 'tenant-professional',
        resource: 'billing',
        resourceId: null,
        ip: '10.0.0.5',
        userAgent: 'Mozilla/5.0',
        before: { plan: 'community' },
        after: { plan: 'professional' },
        metadata: {},
        timestamp: isoNow(-60),
      },
      {
        action: 'connector_created',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'connectors',
        resourceId: 'conn-001',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: { name: 'SAP ERP' },
        metadata: {},
        timestamp: isoNow(-22),
      },
      {
        action: 'admin_action',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'admin',
        resourceId: null,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { action: 'export_users' },
        timestamp: isoNow(-10),
      },
      {
        action: 'mfa_verified',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'mfa',
        resourceId: null,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { device: 'MacBook Pro' },
        timestamp: isoNow(-1),
      },
      {
        action: 'logout',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'auth',
        resourceId: null,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: {},
        timestamp: isoNow(-1),
      },
      {
        action: 'data_exported',
        actor: 'admin@atlas.enterprise.com',
        tenantId: 'tenant-enterprise',
        resource: 'users',
        resourceId: null,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        before: null,
        after: null,
        metadata: { format: 'csv', rows: 150 },
        timestamp: isoNow(-5),
      },
      {
        action: 'certificate_renewed',
        actor: 'system',
        tenantId: 'tenant-enterprise',
        resource: 'certificates',
        resourceId: 'cert-001',
        ip: '127.0.0.1',
        userAgent: 'AtlasAgent/1.0',
        before: { expiresAt: isoNow(-1) },
        after: { expiresAt: isoNow(364) },
        metadata: {},
        timestamp: isoNow(-8),
      },
    ];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      const full: AuditEvent = { id: `evt-seed-${String(i + 1).padStart(3, '0')}`, ...ev };
      this.auditChain.push(appendEntry(this.auditChain, full));
    }
  }

  // ─── Risk seeding ──────────────────────────────────────────────────────────

  private _seedRiskEvents(): void {
    const events: RiskEvent[] = [
      {
        id: 'risk-001',
        type: 'repeated_auth_failure',
        tenantId: 'tenant-enterprise',
        actor: 'unknown@hacker.example.com',
        level: 'HIGH',
        score: 80,
        description: '5 failed login attempts in 10 minutes',
        ip: '5.5.5.5',
        country: 'CN',
        resolved: false,
        detectedAt: isoNow(-15),
      },
      {
        id: 'risk-002',
        type: 'login_from_new_country',
        tenantId: 'tenant-professional',
        actor: 'user@atlas.professional.com',
        level: 'MEDIUM',
        score: 55,
        description: 'Login from Brazil — first time from this country',
        ip: '177.20.50.1',
        country: 'BR',
        resolved: true,
        detectedAt: isoNow(-20),
      },
      {
        id: 'risk-003',
        type: 'privilege_escalation',
        tenantId: 'tenant-enterprise',
        actor: 'contractor@partner.example.com',
        level: 'CRITICAL',
        score: 95,
        description: 'Contractor account attempted to access admin panel',
        ip: '203.0.113.42',
        country: 'US',
        resolved: false,
        detectedAt: isoNow(-2),
      },
      {
        id: 'risk-004',
        type: 'suspicious_ip',
        tenantId: 'tenant-enterprise',
        actor: 'api-service',
        level: 'MEDIUM',
        score: 60,
        description: 'Request from known Tor exit node',
        ip: '185.220.101.1',
        country: null,
        resolved: false,
        detectedAt: isoNow(-3),
      },
      {
        id: 'risk-005',
        type: 'anomalous_behavior',
        tenantId: 'tenant-professional',
        actor: 'user@atlas.professional.com',
        level: 'LOW',
        score: 25,
        description: 'Unusual time-of-day access pattern',
        ip: '10.0.0.5',
        country: 'BR',
        resolved: true,
        detectedAt: isoNow(-7),
      },
      {
        id: 'risk-006',
        type: 'rate_limit_abuse',
        tenantId: 'tenant-community',
        actor: 'dev@atlas.community.com',
        level: 'LOW',
        score: 30,
        description: 'Hit rate limit 3 times in 1 hour',
        ip: '200.100.50.25',
        country: 'BR',
        resolved: true,
        detectedAt: isoNow(-10),
      },
      {
        id: 'risk-007',
        type: 'token_reuse',
        tenantId: 'tenant-enterprise',
        actor: 'service-account@enterprise.com',
        level: 'HIGH',
        score: 75,
        description: 'Expired JWT token presented twice from different IPs',
        ip: '10.0.10.1',
        country: 'US',
        resolved: false,
        detectedAt: isoNow(-1),
      },
      {
        id: 'risk-008',
        type: 'bot_detected',
        tenantId: 'tenant-enterprise',
        actor: 'unknown',
        level: 'MEDIUM',
        score: 65,
        description: 'Automated scraping pattern on API endpoints',
        ip: '198.18.0.100',
        country: null,
        resolved: false,
        detectedAt: isoNow(0),
      },
      {
        id: 'risk-009',
        type: 'login_from_new_country',
        tenantId: 'tenant-enterprise',
        actor: 'admin@atlas.enterprise.com',
        level: 'LOW',
        score: 20,
        description: 'Login from Singapore — known business trip',
        ip: '128.25.1.1',
        country: 'SG',
        resolved: true,
        detectedAt: isoNow(-6),
      },
      {
        id: 'risk-010',
        type: 'repeated_auth_failure',
        tenantId: 'tenant-professional',
        actor: 'partner@integration.example.com',
        level: 'MEDIUM',
        score: 50,
        description: 'API key auth failed 3 times — likely rotated',
        ip: '54.200.1.1',
        country: 'US',
        resolved: true,
        detectedAt: isoNow(-4),
      },
    ];
    for (const e of events) this.riskEvents.set(e.id, e);
  }

  // ─── Certificates seeding ─────────────────────────────────────────────────

  private _seedCertificates(): void {
    const certs: Certificate[] = [
      {
        id: 'cert-001',
        name: 'Atlas Agent TLS Certificate',
        usage: 'tls',
        tenantId: 'tenant-enterprise',
        subject: 'CN=atlas-agent.enterprise.com',
        issuer: "CN=Let's Encrypt R3",
        serialNumber: '03:AB:CD:EF',
        thumbprint: 'SHA256:a1b2c3d4e5f6',
        issuedAt: isoNow(-340),
        expiresAt: isoNow(25),
        daysUntilExpiry: 25,
        autoRenew: true,
        renewedAt: null,
      },
      {
        id: 'cert-002',
        name: 'API Gateway Certificate',
        usage: 'tls',
        tenantId: 'tenant-enterprise',
        subject: 'CN=api.atlas-connect.io',
        issuer: 'CN=DigiCert TLS RSA',
        serialNumber: '04:EF:AB:12',
        thumbprint: 'SHA256:b2c3d4e5f6a1',
        issuedAt: isoNow(-275),
        expiresAt: isoNow(90),
        daysUntilExpiry: 90,
        autoRenew: true,
        renewedAt: isoNow(-8),
      },
      {
        id: 'cert-003',
        name: 'mTLS Client Certificate',
        usage: 'mtls_client',
        tenantId: 'tenant-enterprise',
        subject: 'CN=atlas-service,O=Seltriva',
        issuer: 'CN=Atlas Internal CA',
        serialNumber: '01:FF:00:AA',
        thumbprint: 'SHA256:c3d4e5f6a1b2',
        issuedAt: isoNow(-185),
        expiresAt: isoNow(180),
        daysUntilExpiry: 180,
        autoRenew: false,
        renewedAt: null,
      },
      {
        id: 'cert-004',
        name: 'Code Signing Certificate',
        usage: 'code_signing',
        tenantId: 'tenant-enterprise',
        subject: 'CN=atlas-agent-release,O=Seltriva',
        issuer: 'CN=DigiCert Code Signing',
        serialNumber: '02:AA:BB:CC',
        thumbprint: 'SHA256:d4e5f6a1b2c3',
        issuedAt: isoNow(-1),
        expiresAt: isoNow(365),
        daysUntilExpiry: 365,
        autoRenew: false,
        renewedAt: null,
      },
    ];
    for (const c of certs) this.certificates.set(c.id, c);
  }

  // ─── Compliance seeding ───────────────────────────────────────────────────

  private _seedCompliance(): void {
    const controls: ComplianceControl[] = [
      {
        id: 'cc-001',
        framework: 'LGPD',
        control: 'Art. 46 — Medidas de Segurança',
        description: 'Implementação de medidas técnicas e administrativas de segurança',
        status: 'compliant',
        evidence: 'AES-256-GCM encryption, audit chain, access controls',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-002',
        framework: 'LGPD',
        control: 'Art. 37 — Registro de Operações',
        description: 'Manutenção de registro das operações de tratamento de dados pessoais',
        status: 'compliant',
        evidence: 'Immutable audit chain with SHA-256 hash linkage',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-003',
        framework: 'LGPD',
        control: 'Art. 18 — Direitos do Titular',
        description: 'Garantia dos direitos de acesso, correção, exclusão e portabilidade',
        status: 'partial',
        evidence: 'Access and deletion implemented; portability in progress',
        lastAssessedAt: isoNow(-14),
      },
      {
        id: 'cc-004',
        framework: 'GDPR',
        control: 'Art. 25 — Data Protection by Design',
        description: 'Privacy by design and by default',
        status: 'compliant',
        evidence: 'Envelope encryption, secrets management, minimal data collection',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-005',
        framework: 'GDPR',
        control: 'Art. 30 — Records of Processing Activities',
        description: 'Maintain records of all processing activities',
        status: 'compliant',
        evidence: 'Full audit chain + SIEM export capability',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-006',
        framework: 'GDPR',
        control: 'Art. 33 — Notification of Data Breach',
        description: 'Notify supervisory authority within 72h of breach',
        status: 'partial',
        evidence: 'Risk detection in place; breach notification workflow pending',
        lastAssessedAt: isoNow(-21),
      },
      {
        id: 'cc-007',
        framework: 'SOC2',
        control: 'CC6.1 — Logical Access',
        description: 'Logical access security software, infrastructure, and architectures',
        status: 'compliant',
        evidence: 'RBAC+ABAC policy engine, MFA enforcement, SSO integration',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-008',
        framework: 'SOC2',
        control: 'CC7.2 — System Monitoring',
        description: 'Monitor system components for anomalies',
        status: 'compliant',
        evidence: 'Risk detection engine, real-time audit events, SIEM integration',
        lastAssessedAt: isoNow(-3),
      },
      {
        id: 'cc-009',
        framework: 'ISO27001',
        control: 'A.10.1 — Cryptography Policy',
        description: 'Policy on the use of cryptographic controls',
        status: 'compliant',
        evidence: 'Envelope encryption, HMAC signing, certificate lifecycle management',
        lastAssessedAt: isoNow(-7),
      },
      {
        id: 'cc-010',
        framework: 'ISO27001',
        control: 'A.12.4 — Logging and Monitoring',
        description: 'Event logging and monitoring capabilities',
        status: 'compliant',
        evidence: 'Immutable audit chain, risk events, SIEM export, dashboard',
        lastAssessedAt: isoNow(-3),
      },
    ];
    for (const c of controls) this.complianceControls.set(c.id, c);
  }

  // ─── Consent seeding ──────────────────────────────────────────────────────

  private _seedConsent(): void {
    const records: ConsentRecord[] = [
      {
        id: 'con-001',
        tenantId: 'tenant-enterprise',
        userId: 'admin@atlas.enterprise.com',
        purpose: 'data_processing',
        granted: true,
        grantedAt: isoNow(-90),
        revokedAt: null,
        framework: 'LGPD',
        source: 'registration_flow',
        ipAddress: '192.168.1.10',
        version: '1.2',
      },
      {
        id: 'con-002',
        tenantId: 'tenant-enterprise',
        userId: 'admin@atlas.enterprise.com',
        purpose: 'analytics',
        granted: true,
        grantedAt: isoNow(-90),
        revokedAt: null,
        framework: 'GDPR',
        source: 'registration_flow',
        ipAddress: '192.168.1.10',
        version: '1.2',
      },
      {
        id: 'con-003',
        tenantId: 'tenant-enterprise',
        userId: 'admin@atlas.enterprise.com',
        purpose: 'marketing',
        granted: false,
        grantedAt: null,
        revokedAt: isoNow(-30),
        framework: 'GDPR',
        source: 'preferences_page',
        ipAddress: '192.168.1.10',
        version: '1.2',
      },
      {
        id: 'con-004',
        tenantId: 'tenant-professional',
        userId: 'user@atlas.professional.com',
        purpose: 'data_processing',
        granted: true,
        grantedAt: isoNow(-60),
        revokedAt: null,
        framework: 'LGPD',
        source: 'registration_flow',
        ipAddress: '10.0.0.5',
        version: '1.2',
      },
      {
        id: 'con-005',
        tenantId: 'tenant-professional',
        userId: 'user@atlas.professional.com',
        purpose: 'analytics',
        granted: false,
        grantedAt: null,
        revokedAt: isoNow(-45),
        framework: 'GDPR',
        source: 'preferences_page',
        ipAddress: '10.0.0.5',
        version: '1.2',
      },
      {
        id: 'con-006',
        tenantId: 'tenant-community',
        userId: 'dev@atlas.community.com',
        purpose: 'data_processing',
        granted: true,
        grantedAt: isoNow(-30),
        revokedAt: null,
        framework: 'LGPD',
        source: 'registration_flow',
        ipAddress: '200.100.50.25',
        version: '1.2',
      },
    ];
    for (const r of records) this.consentRecords.set(r.id, r);
  }

  // ─── Secrets API ──────────────────────────────────────────────────────────

  getSecrets(tenantId: string): SecretMetadata[] {
    return [...this.secrets.values()]
      .filter((s) => s.tenantId === tenantId)
      .map(({ encryptedValue: _, ...rest }) => ({ ...rest, masked: maskSecret(rest.id) }));
  }

  /** All secrets across all tenants — used internally by the rotation scheduler. */
  listAllSecrets(): Secret[] {
    return [...this.secrets.values()];
  }

  getSecretById(id: string): Secret | undefined {
    return this.secrets.get(id);
  }

  /** Attempts to sync a secret's plaintext to its declared external provider (Vault only, for now). */
  private async syncToProvider(
    provider: Secret['provider'],
    path: string,
    value: string
  ): Promise<{
    vaultStatus: Secret['vaultStatus'];
    vaultVersion: number | null;
  }> {
    if (provider !== 'hashicorp_vault') return { vaultStatus: null, vaultVersion: null };
    if (!vaultAdapter.isConfigured()) return { vaultStatus: 'not_configured', vaultVersion: null };
    try {
      const result = await vaultAdapter.write(path, { value });
      return { vaultStatus: 'synced', vaultVersion: result.version };
    } catch {
      return { vaultStatus: 'error', vaultVersion: null };
    }
  }

  async createSecret(
    tenantId: string,
    data: {
      name: string;
      description: string;
      type: Secret['type'];
      provider: Secret['provider'];
      value: string;
      tags: string[];
      expiresAt: string | null;
      autoRotate?: boolean;
      rotationIntervalDays?: number | null;
    }
  ): Promise<SecretMetadata> {
    const id = `sec-${Date.now()}`;
    const now = new Date().toISOString();
    const { vaultStatus, vaultVersion } = await this.syncToProvider(
      data.provider,
      `${tenantId}/${id}`,
      data.value
    );
    const secret: Secret = {
      id,
      tenantId,
      name: data.name,
      description: data.description,
      type: data.type,
      provider: data.provider,
      encryptedValue: encrypt(data.value),
      version: 1,
      rotatedAt: now,
      expiresAt: data.expiresAt,
      tags: data.tags,
      autoRotate: data.autoRotate ?? false,
      rotationIntervalDays: data.rotationIntervalDays ?? null,
      vaultStatus,
      vaultVersion,
      createdAt: now,
      updatedAt: now,
    };
    this.secrets.set(id, secret);
    const { encryptedValue: _, ...rest } = secret;
    return { ...rest, masked: maskSecret(id) };
  }

  async rotateSecret(id: string, newValue: string): Promise<SecretMetadata | undefined> {
    const s = this.secrets.get(id);
    if (!s) return undefined;
    const now = new Date().toISOString();
    const { vaultStatus, vaultVersion } = await this.syncToProvider(
      s.provider,
      `${s.tenantId}/${id}`,
      newValue
    );
    const updated: Secret = {
      ...s,
      encryptedValue: encrypt(newValue),
      version: s.version + 1,
      rotatedAt: now,
      updatedAt: now,
      vaultStatus: s.provider === 'hashicorp_vault' ? vaultStatus : s.vaultStatus,
      vaultVersion: s.provider === 'hashicorp_vault' ? vaultVersion : s.vaultVersion,
    };
    this.secrets.set(id, updated);
    const { encryptedValue: _, ...rest } = updated;
    return { ...rest, masked: maskSecret(id) };
  }

  deleteSecret(id: string): boolean {
    return this.secrets.delete(id);
  }

  /** Extends a secret's expiry to start a new rotation cycle — used by the rotation scheduler. */
  updateSecretExpiry(id: string, expiresAt: string | null): Secret | undefined {
    const s = this.secrets.get(id);
    if (!s) return undefined;
    const updated: Secret = { ...s, expiresAt, updatedAt: new Date().toISOString() };
    this.secrets.set(id, updated);
    return updated;
  }

  // ─── MFA API ──────────────────────────────────────────────────────────────

  getMfaRecord(tenantId: string, userId: string): MfaRecord | undefined {
    return this.mfaRecords.get(`${tenantId}:${userId}`);
  }

  getMfaByTenant(tenantId: string): MfaRecord[] {
    return [...this.mfaRecords.values()].filter((r) => r.tenantId === tenantId);
  }

  upsertMfaRecord(rec: MfaRecord): void {
    this.mfaRecords.set(`${rec.tenantId}:${rec.userId}`, rec);
  }

  // ─── SSO API ──────────────────────────────────────────────────────────────

  getSsoProviders(tenantId: string): SSOProvider[] {
    return [...this.ssoProviders.values()].filter((p) => p.tenantId === tenantId);
  }

  getSsoProviderById(id: string): SSOProvider | undefined {
    return this.ssoProviders.get(id);
  }

  createSsoProvider(data: Omit<SSOProvider, 'id' | 'createdAt'>): SSOProvider {
    const id = `sso-${Date.now()}`;
    const provider: SSOProvider = { id, ...data, createdAt: new Date().toISOString() };
    this.ssoProviders.set(id, provider);
    return provider;
  }

  deleteSsoProvider(id: string): boolean {
    return this.ssoProviders.delete(id);
  }

  // ─── Policies API ─────────────────────────────────────────────────────────

  getPolicies(tenantId?: string): Policy[] {
    return [...this.policies.values()].filter(
      (p) => p.tenantId === null || p.tenantId === tenantId
    );
  }

  getPolicyById(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  createPolicy(data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Policy {
    const id = `pol-${Date.now()}`;
    const now = new Date().toISOString();
    const policy: Policy = { id, ...data, version: 1, createdAt: now, updatedAt: now };
    this.policies.set(id, policy);
    return policy;
  }

  updatePolicy(id: string, patch: Partial<Policy>): Policy | undefined {
    const p = this.policies.get(id);
    if (!p) return undefined;
    const updated: Policy = {
      ...p,
      ...patch,
      id: p.id,
      version: p.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(id, updated);
    return updated;
  }

  deletePolicy(id: string): boolean {
    return this.policies.delete(id);
  }

  // ─── Audit API ────────────────────────────────────────────────────────────

  getAuditEntries(tenantId?: string, limit = 50, offset = 0): AuditEntry[] {
    const filtered = tenantId
      ? this.auditChain.filter((e) => e.event.tenantId === tenantId)
      : this.auditChain;
    return filtered.slice(offset, offset + limit);
  }

  getAuditChain(): AuditEntry[] {
    return [...this.auditChain];
  }

  appendAuditEvent(event: AuditEvent): AuditEntry {
    const entry = appendEntry(this.auditChain, event);
    this.auditChain.push(entry);
    return entry;
  }

  // ─── Risk API ─────────────────────────────────────────────────────────────

  getRiskEvents(tenantId?: string): RiskEvent[] {
    const all = [...this.riskEvents.values()];
    return tenantId ? all.filter((e) => e.tenantId === tenantId) : all;
  }

  computeRiskScore(tenantId: string): RiskScore {
    const events = this.getRiskEvents(tenantId).filter((e) => !e.resolved);
    const score = events.reduce((sum, e) => Math.max(sum, e.score), 0);
    let level: RiskLevel = 'LOW';
    if (score >= 90) level = 'CRITICAL';
    else if (score >= 70) level = 'HIGH';
    else if (score >= 40) level = 'MEDIUM';
    return {
      tenantId,
      score,
      level,
      factors: events.map((e) => e.description),
      computedAt: new Date().toISOString(),
    };
  }

  createRiskEvent(event: Omit<RiskEvent, 'id' | 'detectedAt'>): RiskEvent {
    const id = `risk-${Date.now()}`;
    const full: RiskEvent = { id, ...event, detectedAt: new Date().toISOString() };
    this.riskEvents.set(id, full);
    return full;
  }

  resolveRiskEvent(id: string): RiskEvent | undefined {
    const e = this.riskEvents.get(id);
    if (!e) return undefined;
    const updated = { ...e, resolved: true };
    this.riskEvents.set(id, updated);
    return updated;
  }

  // ─── Certificates API ─────────────────────────────────────────────────────

  getCertificates(tenantId: string): Certificate[] {
    return [...this.certificates.values()].filter((c) => c.tenantId === tenantId);
  }

  getCertificateById(id: string): Certificate | undefined {
    return this.certificates.get(id);
  }

  renewCertificate(id: string): Certificate | undefined {
    const c = this.certificates.get(id);
    if (!c) return undefined;
    const now = new Date();
    const newExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const updated: Certificate = {
      ...c,
      issuedAt: now.toISOString(),
      expiresAt: newExpiry.toISOString(),
      daysUntilExpiry: 365,
      renewedAt: now.toISOString(),
    };
    this.certificates.set(id, updated);
    return updated;
  }

  // ─── Compliance API ───────────────────────────────────────────────────────

  getComplianceControls(framework?: string): ComplianceControl[] {
    const all = [...this.complianceControls.values()];
    return framework ? all.filter((c) => c.framework === framework) : all;
  }

  createDataRequest(
    data: Omit<DataRequest, 'id' | 'requestedAt' | 'deadlineAt' | 'completedAt'>
  ): DataRequest {
    const id = `dr-${Date.now()}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const req: DataRequest = {
      id,
      ...data,
      requestedAt: now.toISOString(),
      completedAt: null,
      deadlineAt: deadline.toISOString(),
    };
    this.dataRequests.set(id, req);
    return req;
  }

  getDataRequests(tenantId?: string): DataRequest[] {
    const all = [...this.dataRequests.values()];
    return tenantId ? all.filter((r) => r.tenantId === tenantId) : all;
  }

  // ─── Consent API ──────────────────────────────────────────────────────────

  getConsentRecords(tenantId: string): ConsentRecord[] {
    return [...this.consentRecords.values()].filter((r) => r.tenantId === tenantId);
  }

  upsertConsent(data: Omit<ConsentRecord, 'id'>): ConsentRecord {
    const existing = [...this.consentRecords.values()].find(
      (r) => r.tenantId === data.tenantId && r.userId === data.userId && r.purpose === data.purpose
    );
    if (existing) {
      const updated = { ...existing, ...data, id: existing.id };
      this.consentRecords.set(existing.id, updated);
      return updated;
    }
    const id = `con-${Date.now()}`;
    const rec: ConsentRecord = { id, ...data };
    this.consentRecords.set(id, rec);
    return rec;
  }

  revokeConsent(
    tenantId: string,
    userId: string,
    purpose: ConsentRecord['purpose']
  ): ConsentRecord | undefined {
    const rec = [...this.consentRecords.values()].find(
      (r) => r.tenantId === tenantId && r.userId === userId && r.purpose === purpose
    );
    if (!rec) return undefined;
    const updated = { ...rec, granted: false, revokedAt: new Date().toISOString() };
    this.consentRecords.set(rec.id, updated);
    return updated;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  getDashboard(tenantId: string): SecurityDashboard {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const eventsToday = this.auditChain.filter(
      (e) => e.event.tenantId === tenantId && e.timestamp.startsWith(todayStr)
    ).length;

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const failedAuthLast24h = this.auditChain.filter(
      (e) =>
        e.event.tenantId === tenantId &&
        e.event.action === 'login_failed' &&
        new Date(e.timestamp) >= yesterday
    ).length;

    const suspiciousLogins = this.auditChain.filter(
      (e) => e.event.tenantId === tenantId && e.event.action === 'login_failed'
    ).length;

    const certsExpiringSoon = this.getCertificates(tenantId).filter(
      (c) => c.daysUntilExpiry <= 30
    ).length;

    const mfaRecords = this.getMfaByTenant(tenantId);
    const enrolled = mfaRecords.filter((r) => r.enrolled).length;
    const mfaAdoptionPct =
      mfaRecords.length > 0 ? Math.round((enrolled / mfaRecords.length) * 100) : 0;

    const activePolicies = this.getPolicies(tenantId).filter((p) => p.active).length;

    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const riskEventsLast7d = this.getRiskEvents(tenantId).filter(
      (e) => new Date(e.detectedAt) >= sevenDaysAgo
    ).length;

    const controls = this.getComplianceControls();
    const frameworks = ['LGPD', 'GDPR', 'SOC2', 'ISO27001', 'OWASP_ASVS'] as const;
    const compliance = Object.fromEntries(
      frameworks.map((fw) => {
        const fwControls = controls.filter((c) => c.framework === fw);
        const statuses = fwControls.map((c) => c.status);
        const status = statuses.every((s) => s === 'compliant')
          ? 'compliant'
          : statuses.some((s) => s === 'non_compliant')
            ? 'non_compliant'
            : statuses.some((s) => s === 'partial')
              ? 'partial'
              : 'not_assessed';
        return [fw, status];
      })
    ) as Record<
      (typeof frameworks)[number],
      'compliant' | 'partial' | 'non_compliant' | 'not_assessed'
    >;

    const criticalAlerts: string[] = [];
    if (certsExpiringSoon > 0)
      criticalAlerts.push(`${certsExpiringSoon} certificate(s) expiring within 30 days`);
    const criticalRisk = this.getRiskEvents(tenantId).filter(
      (e) => e.level === 'CRITICAL' && !e.resolved
    );
    if (criticalRisk.length > 0)
      criticalAlerts.push(`${criticalRisk.length} unresolved CRITICAL risk event(s)`);

    const riskScores = ['tenant-enterprise', 'tenant-professional', 'tenant-community']
      .filter((t) => t === tenantId)
      .map((t) => this.computeRiskScore(t));

    return {
      eventsToday,
      failedAuthLast24h,
      suspiciousLogins,
      certsExpiringSoon,
      mfaAdoptionPct,
      activePolicies,
      riskEventsLast7d,
      compliance,
      criticalAlerts,
      riskScores,
    };
  }
}

export const securityStore = new SecurityStore();
