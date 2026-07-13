import { createVerify } from 'node:crypto';

/**
 * Registry of trusted public keys (PEM format), keyed by an arbitrary ID.
 * The Runtime populates this from its key store at startup.
 */
export class TrustedKeyRegistry {
  private readonly _keys = new Map<string, string>();

  addKey(id: string, publicKeyPem: string): void {
    this._keys.set(id, publicKeyPem);
  }

  removeKey(id: string): void {
    this._keys.delete(id);
  }

  getKey(id: string): string | undefined {
    return this._keys.get(id);
  }

  hasKey(id: string): boolean {
    return this._keys.has(id);
  }

  get size(): number {
    return this._keys.size;
  }
}

/**
 * Verifies RSA-PSS / RSA-PKCS1 signatures produced by the connector vendor.
 *
 * Signature format: base64url-encoded SHA-256 digest of the plugin bundle,
 * signed with the vendor's RSA private key.
 */
export class SignatureVerifier {
  constructor(private readonly _keys: TrustedKeyRegistry) {}

  /**
   * Verify that `signatureBase64` is a valid RSA-PSS (SHA-256) signature of
   * `data` using the public key registered under `publicKeyId`.
   *
   * Returns false (does not throw) when the signature is mathematically invalid.
   * Throws `SignatureVerificationError` when the key is unknown.
   */
  verify(publicKeyId: string, data: Buffer, signatureBase64: string): boolean {
    const pem = this._keys.getKey(publicKeyId);
    if (!pem) {
      throw new SignatureVerificationError(
        `Unknown public key ID: "${publicKeyId}". Register the vendor's key first.`
      );
    }

    try {
      const verify = createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(
        { key: pem, padding: 3 /* RSA_PKCS1_PSS_PADDING */ },
        Buffer.from(signatureBase64, 'base64')
      );
    } catch {
      return false;
    }
  }
}

export class SignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureVerificationError';
  }
}
