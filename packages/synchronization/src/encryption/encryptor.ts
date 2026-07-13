/**
 * Encryptor — AES-256-GCM authenticated encryption.
 *
 * Each encrypted payload includes:
 *  - IV (12 bytes, random)
 *  - Auth tag (16 bytes, GCM)
 *  - Ciphertext
 *
 * Wire format (base64-encoded envelope):
 *   <iv_hex>:<authTag_hex>:<ciphertext_base64>
 *
 * Keys are derived from a 32-byte hex key string or a Buffer.
 * TLS is provided at the transport layer (Atlas Cloud dispatcher).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { EncryptionConfig, SyncResult } from '../types/index.js';
import { syncOk, syncFail } from '../types/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptResult {
  readonly ciphertext: Buffer;
  readonly iv: string; // hex
  readonly authTag: string; // hex
  readonly keyId: string;
}

export class Encryptor {
  private readonly _config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    this._config = config;
  }

  async encrypt(input: Buffer, keyBuffer: Buffer): Promise<SyncResult<EncryptResult>> {
    if (!this._config.enabled) {
      return syncOk({ ciphertext: input, iv: '', authTag: '', keyId: this._config.keyId });
    }

    if (keyBuffer.length !== 32) {
      return syncFail('INVALID_KEY', 'AES-256 requires a 32-byte key');
    }

    try {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

      const chunks: Buffer[] = [cipher.update(input)];
      chunks.push(cipher.final());

      const ciphertext = Buffer.concat(chunks);
      const authTag = (
        cipher as ReturnType<typeof createCipheriv> & { getAuthTag(): Buffer }
      ).getAuthTag();

      return syncOk({
        ciphertext,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId: this._config.keyId,
      });
    } catch (err) {
      return syncFail('ENCRYPTION_FAILED', `Encryption failed: ${(err as Error).message}`, {
        cause: err as Error,
      });
    }
  }

  async decrypt(
    ciphertext: Buffer,
    iv: string,
    authTag: string,
    keyBuffer: Buffer
  ): Promise<SyncResult<Buffer>> {
    if (!this._config.enabled) {
      return syncOk(ciphertext);
    }

    try {
      const ivBuf = Buffer.from(iv, 'hex');
      const authTagBuf = Buffer.from(authTag, 'hex');

      const decipher = createDecipheriv(ALGORITHM, keyBuffer, ivBuf) as ReturnType<
        typeof createDecipheriv
      > & { setAuthTag(tag: Buffer): void };

      decipher.setAuthTag(authTagBuf);

      const chunks: Buffer[] = [decipher.update(ciphertext)];
      chunks.push(decipher.final());

      return syncOk(Buffer.concat(chunks));
    } catch (err) {
      return syncFail('DECRYPTION_FAILED', `Decryption failed: ${(err as Error).message}`, {
        cause: err as Error,
        context: { keyId: this._config.keyId },
      });
    }
  }
}
