import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  timingSafeEqual,
} from 'node:crypto';

// Default test key — 32 bytes (64 hex chars). Override via ATLAS_MASTER_KEY env var.
const DEFAULT_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getMasterKey(): Buffer {
  const hex = process.env['ATLAS_MASTER_KEY'] ?? DEFAULT_MASTER_KEY;
  if (hex.length !== 64) {
    throw new Error('ATLAS_MASTER_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

// ─── AES-256-GCM primitive ────────────────────────────────────────────────────

interface GcmBlock {
  iv: string;
  data: string;
  authTag: string;
}

function gcmEncrypt(key: Buffer, plaintext: string): GcmBlock {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

function gcmDecrypt(key: Buffer, block: GcmBlock): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(block.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(block.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(block.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ─── Envelope Encryption ──────────────────────────────────────────────────────

export interface EncryptedEnvelope {
  version: 'aegis-aes256gcm-v1';
  encryptedDek: GcmBlock;
  payload: GcmBlock;
}

/**
 * Envelope-encrypts plaintext:
 *   1. Generate a fresh DEK (32 random bytes)
 *   2. Encrypt DEK with Master Key → encryptedDek
 *   3. Encrypt plaintext with DEK → payload
 */
export function envelopeEncrypt(plaintext: string): EncryptedEnvelope {
  const dek = randomBytes(32);
  const payload = gcmEncrypt(dek, plaintext);
  const encryptedDek = gcmEncrypt(getMasterKey(), dek.toString('hex'));
  return { version: 'aegis-aes256gcm-v1', encryptedDek, payload };
}

/**
 * Decrypts an envelope:
 *   1. Decrypt DEK from encryptedDek using Master Key
 *   2. Decrypt payload using DEK
 */
export function envelopeDecrypt(envelope: EncryptedEnvelope): string {
  const dekHex = gcmDecrypt(getMasterKey(), envelope.encryptedDek);
  const dek = Buffer.from(dekHex, 'hex');
  return gcmDecrypt(dek, envelope.payload);
}

/** Serializes an envelope to a compact JSON string for storage. */
export function serializeEnvelope(env: EncryptedEnvelope): string {
  return JSON.stringify(env);
}

/** Deserializes a stored JSON string back to an envelope. */
export function deserializeEnvelope(json: string): EncryptedEnvelope {
  return JSON.parse(json) as EncryptedEnvelope;
}

// ─── HMAC utilities ───────────────────────────────────────────────────────────

/**
 * Computes HMAC-SHA256 of payload using the master key.
 * Use for request signing, webhook verification, etc.
 */
export function hmacSign(payload: string, secret?: string): string {
  const key = secret ?? getMasterKey().toString('hex');
  return createHmac('sha256', key).update(payload).digest('hex');
}

/** Constant-time HMAC verification. */
export function hmacVerify(payload: string, signature: string, secret?: string): boolean {
  try {
    const expected = Buffer.from(hmacSign(payload, secret), 'hex');
    const provided = Buffer.from(signature, 'hex');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

// ─── Key generation ───────────────────────────────────────────────────────────

/** Generates a cryptographically random hex key of the given byte length. */
export function generateKey(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Generates a random nonce (24 hex chars = 12 bytes). */
export function generateNonce(): string {
  return randomBytes(12).toString('hex');
}

/** SHA-256 hash of a string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ─── Request signing ──────────────────────────────────────────────────────────

export interface SignedRequest {
  nonce: string;
  timestamp: string;
  signature: string;
}

/**
 * Signs a request body with nonce + timestamp to prevent replay attacks.
 * signature = HMAC-SHA256(nonce:timestamp:body)
 */
export function signRequest(body: string, secret: string): SignedRequest {
  const nonce = generateNonce();
  const timestamp = Date.now().toString();
  const payload = `${nonce}:${timestamp}:${body}`;
  return { nonce, timestamp, signature: hmacSign(payload, secret) };
}

/**
 * Verifies a signed request. Rejects if:
 * - Signature invalid
 * - Timestamp older than maxAgeMs (default 5 minutes — replay protection)
 */
export function verifySignedRequest(
  body: string,
  signed: SignedRequest,
  secret: string,
  maxAgeMs = 300_000
): boolean {
  const age = Date.now() - parseInt(signed.timestamp, 10);
  if (isNaN(age) || age > maxAgeMs || age < 0) return false;
  const payload = `${signed.nonce}:${signed.timestamp}:${body}`;
  return hmacVerify(payload, signed.signature, secret);
}
