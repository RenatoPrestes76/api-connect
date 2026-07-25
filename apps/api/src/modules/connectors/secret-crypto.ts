import {
  envelopeEncrypt,
  envelopeDecrypt,
  serializeEnvelope,
  deserializeEnvelope,
} from '@seltriva/aegis';

/**
 * Reversible AES-256-GCM envelope encryption for secret-typed template
 * values (passwords, tokens, certificates) — unlike the one-way bcrypt/
 * sha256 hashing used for admin/portal passwords and API key secrets
 * elsewhere in this codebase, connector credentials must be decryptable
 * again later to actually open a connection (Sprint 46.8's job — this
 * sprint only stores them safely).
 */
export function encryptSecretValue(plaintext: string): string {
  return serializeEnvelope(envelopeEncrypt(plaintext));
}

export function decryptSecretValue(serialized: string): string {
  return envelopeDecrypt(deserializeEnvelope(serialized));
}
