export class CredentialNotFoundError extends Error {
  constructor(key: string) {
    super(`Credential "${key}" not found`);
    this.name = 'CredentialNotFoundError';
  }
}

/**
 * Interface for secure credential storage.
 *
 * The provider never accesses the credential store directly — it requests
 * secrets from the SDK, which retrieves them from the platform's secure store
 * (OS keychain, encrypted file, HSM, etc.).
 */
export interface CredentialStore {
  set(key: string, secret: string): Promise<void>;
  get(key: string): Promise<string | null>;
  getRequired(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}
