import { encryptSecretValue, decryptSecretValue } from '../connectors/secret-crypto.js';

/**
 * ERP database credentials reuse the same reversible AES-256-GCM envelope
 * encryption as connector template secrets (connectors/secret-crypto.ts) —
 * this is the exact use case its own comment anticipated: a credential that
 * must be decryptable again later to actually open a connection, unlike the
 * one-way hashing used for admin/portal passwords.
 */
export function encryptCredential(plaintextPassword: string): string {
  return encryptSecretValue(plaintextPassword);
}

/** Decrypts only in memory, only where the caller genuinely needs the plaintext (the Runtime-profiles fetch). Never log or persist the result. */
export function decryptCredential(encryptedCredential: string): string {
  return decryptSecretValue(encryptedCredential);
}

/**
 * Strips connection-string-shaped credentials (`scheme://user:pass@host`)
 * out of free-text error messages before they're persisted to audit
 * metadata or health-check history — a Runtime-reported error string could
 * otherwise leak a raw password verbatim.
 */
export function maskSecretsInText(text: string): string {
  return text.replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, '://***:***@');
}
