/**
 * @seltriva/agent — security
 * Credential storage, TLS enforcement, certificate validation, token rotation.
 *
 * Security invariants:
 *   - Credentials are ALWAYS encrypted at rest with AES-256-GCM
 *   - TLS 1.3 is enforced for all cloud connections in production
 *   - Private keys never leave the agent host
 *   - Token rotation happens in the background without service interruption
 *   - All security events are audited
 *   - Update packages must pass signature verification before installation
 */

import type { AgentResult, CredentialId, AgentId } from '../configuration/index';

// ─── Credential Store ─────────────────────────────────────────────────────

/**
 * AES-256-GCM encrypted credential storage.
 * Credentials can be stored in the OS keychain (preferred) or
 * in an encrypted local file.
 */
export interface CredentialStore {
  /**
   * Store an encrypted credential
   */
  set(id: CredentialId, credential: Credential): Promise<AgentResult<void>>;

  /**
   * Retrieve and decrypt a credential
   */
  get(id: CredentialId): Promise<AgentResult<Credential>>;

  /**
   * Delete a credential
   */
  delete(id: CredentialId): Promise<AgentResult<void>>;

  /**
   * List credential IDs (never returns values)
   */
  list(): Promise<CredentialId[]>;

  /**
   * Check if a credential exists without decrypting
   */
  has(id: CredentialId): Promise<boolean>;

  /**
   * Rotate the encryption key — re-encrypts all stored credentials
   */
  rotateEncryptionKey(newKeyPath: string): Promise<AgentResult<void>>;

  /**
   * Import credentials from an encrypted export file
   */
  import(filePath: string, passphrase: string): Promise<AgentResult<void>>;

  /**
   * Export credentials to an encrypted file (for backup/migration)
   */
  export(filePath: string, passphrase: string): Promise<AgentResult<void>>;
}

export interface Credential {
  readonly id: CredentialId;
  readonly kind: CredentialKind;
  readonly label: string;
  readonly value: string;
  readonly metadata?: CredentialMetadata;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly rotatedAt?: Date;
}

export type CredentialKind =
  | 'database-password'
  | 'api-key'
  | 'bearer-token'
  | 'private-key'
  | 'certificate'
  | 'connection-string'
  | 'oauth-client-secret'
  | 'encryption-key'
  | 'service-account-key';

export interface CredentialMetadata {
  readonly connectorId?: string;
  readonly service?: string;
  readonly username?: string;
  readonly rotationPolicy?: CredentialRotationPolicy;
}

export interface CredentialRotationPolicy {
  readonly enabled: boolean;
  readonly intervalHours: number;
  readonly notifyBeforeHours: number;
}

// ─── Encryption ───────────────────────────────────────────────────────────

export interface EncryptionProvider {
  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(plaintext: string): Promise<EncryptedPayload>;

  /**
   * Decrypt AES-256-GCM ciphertext
   */
  decrypt(payload: EncryptedPayload): Promise<string>;

  /**
   * Derive a key from a passphrase (PBKDF2)
   */
  deriveKey(passphrase: string, salt: Buffer): Promise<Buffer>;

  /**
   * Generate a cryptographically random key
   */
  generateKey(bits: 128 | 192 | 256): Buffer;
}

export interface EncryptedPayload {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly algorithm: 'aes-256-gcm';
  readonly keyId?: string;
}

// ─── TLS Manager ──────────────────────────────────────────────────────────

export interface TLSManager {
  /**
   * Create a TLS configuration for outbound connections.
   * Enforces TLS 1.3 in production.
   */
  createClientOptions(): TLSClientOptions;

  /**
   * Validate a server certificate chain
   */
  validateCertificate(cert: PeerCertificate): CertificateValidationResult;

  /**
   * Load and parse a certificate from disk
   */
  loadCertificate(filePath: string): Promise<AgentResult<ParsedCertificate>>;

  /**
   * Check if a certificate is expiring soon
   */
  checkExpiry(cert: ParsedCertificate, warnBeforeDays?: number): CertificateExpiryStatus;

  /**
   * Get the TLS policy for the current environment
   */
  getPolicy(): TLSPolicy;
}

export interface TLSClientOptions {
  readonly minVersion: 'TLSv1.2' | 'TLSv1.3';
  readonly rejectUnauthorized: boolean;
  readonly cert?: Buffer;
  readonly key?: Buffer;
  readonly ca?: Buffer;
  readonly checkServerIdentity?: (hostname: string, cert: PeerCertificate) => Error | undefined;
}

export interface TLSPolicy {
  readonly minVersion: 'TLSv1.2' | 'TLSv1.3';
  readonly cipherSuites: string[];
  readonly requireClientCert: boolean;
  readonly rejectUnauthorized: boolean;
}

export interface PeerCertificate {
  readonly subject: CertificateDistinguishedName;
  readonly issuer: CertificateDistinguishedName;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly fingerprint: string;
  readonly fingerprint256: string;
  readonly serialNumber: string;
  readonly raw: Buffer;
}

export interface ParsedCertificate {
  readonly subject: CertificateDistinguishedName;
  readonly issuer: CertificateDistinguishedName;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly fingerprint: string;
  readonly serialNumber: string;
  readonly isCA: boolean;
  readonly sans: string[];
}

export interface CertificateDistinguishedName {
  readonly CN?: string;
  readonly O?: string;
  readonly OU?: string;
  readonly C?: string;
  readonly ST?: string;
  readonly L?: string;
}

export interface CertificateValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly chain: ParsedCertificate[];
}

export interface CertificateExpiryStatus {
  readonly isExpired: boolean;
  readonly isExpiringSoon: boolean;
  readonly daysRemaining: number;
  readonly expiresAt: Date;
}

// ─── Token Manager ────────────────────────────────────────────────────────

export interface TokenManager {
  /**
   * Get the current active platform token
   */
  getToken(agentId: AgentId): Promise<AgentResult<string>>;

  /**
   * Rotate the platform token without service interruption.
   * The old token remains valid until the new one is confirmed.
   */
  rotateToken(agentId: AgentId): Promise<AgentResult<void>>;

  /**
   * Register a callback invoked before token expiry
   */
  onTokenExpiring(handler: TokenExpiryHandler): void;

  /**
   * Revoke the current token (used during uninstall)
   */
  revokeToken(agentId: AgentId): Promise<AgentResult<void>>;
}

export type TokenExpiryHandler = (minutesRemaining: number) => void | Promise<void>;

// ─── Signature Verifier ───────────────────────────────────────────────────

export interface SignatureVerifier {
  /**
   * Verify a detached signature on a file (for update packages)
   */
  verifyFile(filePath: string, signaturePath: string): Promise<SignatureVerificationResult>;

  /**
   * Verify a signed manifest (JSON with embedded signature)
   */
  verifyManifest(manifest: SignedManifest): SignatureVerificationResult;

  /**
   * Trust a public key for signature verification
   */
  trustKey(publicKey: string, label: string): void;

  /**
   * List trusted public keys
   */
  listTrustedKeys(): TrustedKey[];
}

export interface SignatureVerificationResult {
  readonly valid: boolean;
  readonly keyId?: string;
  readonly signerLabel?: string;
  readonly signedAt?: Date;
  readonly error?: string;
}

export interface SignedManifest {
  readonly payload: Record<string, unknown>;
  readonly signature: string;
  readonly keyId: string;
  readonly algorithm: string;
}

export interface TrustedKey {
  readonly id: string;
  readonly label: string;
  readonly publicKey: string;
  readonly addedAt: Date;
  readonly fingerprint: string;
}

// ─── Security Audit ───────────────────────────────────────────────────────

export interface SecurityAuditLog {
  append(event: SecurityAuditEvent): void;
  query(filter: SecurityAuditFilter): SecurityAuditEvent[];
}

export interface SecurityAuditEvent {
  readonly id: string;
  readonly kind: SecurityAuditEventKind;
  readonly actor: string;
  readonly target?: string;
  readonly outcome: 'allowed' | 'denied' | 'error';
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
  readonly agentId: AgentId;
}

export type SecurityAuditEventKind =
  | 'credential-accessed'
  | 'credential-created'
  | 'credential-deleted'
  | 'credential-rotated'
  | 'token-issued'
  | 'token-rotated'
  | 'token-revoked'
  | 'tls-handshake'
  | 'certificate-validated'
  | 'signature-verified'
  | 'update-verified'
  | 'config-encrypted'
  | 'unauthorized-access-attempt';

export interface SecurityAuditFilter {
  readonly kinds?: SecurityAuditEventKind[];
  readonly outcome?: 'allowed' | 'denied' | 'error';
  readonly since?: Date;
  readonly limit?: number;
}
