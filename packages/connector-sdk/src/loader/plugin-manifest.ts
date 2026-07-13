import type { ConnectorCategory, ConnectorCapabilities } from '../interfaces/metadata.js';

/**
 * The `connector.json` manifest that must be present in every plugin directory.
 */
export interface PluginManifest {
  /** Reverse-domain unique ID: e.g. "com.acme.mssql-connector" */
  readonly id: string;
  /** Display name shown in the Atlas Console. */
  readonly name: string;
  readonly version: string;
  /** Minimum connector-sdk version required. */
  readonly sdkVersion: string;
  readonly vendor: string;
  readonly category: ConnectorCategory;
  readonly description: string;
  /** Relative path to the entry file (e.g. "dist/index.js"). */
  readonly entry: string;
  /** SHA-256 hex of the entry file's contents. */
  readonly hash: string;
  /**
   * Base64url RSA-PSS (SHA-256) signature of the hash field.
   * Empty string disables signature verification (development only).
   */
  readonly signature: string;
  /** Key ID in the TrustedKeyRegistry to verify the signature. */
  readonly publicKeyId: string;
  readonly capabilities: ConnectorCapabilities;
  readonly updatable: boolean;
  readonly homepage?: string;
}

export class PluginManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginManifestError';
  }
}

const REQUIRED_FIELDS: (keyof PluginManifest)[] = [
  'id',
  'name',
  'version',
  'sdkVersion',
  'vendor',
  'category',
  'description',
  'entry',
  'hash',
];

export function validateManifest(raw: unknown): PluginManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new PluginManifestError('connector.json must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (typeof obj[field] !== 'string' || !(obj[field] as string).trim()) {
      throw new PluginManifestError(
        `connector.json: required field "${field}" is missing or empty`
      );
    }
  }
  return raw as PluginManifest;
}
