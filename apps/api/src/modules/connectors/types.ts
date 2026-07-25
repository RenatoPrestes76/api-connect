// ─── Categories ─────────────────────────────────────────────────────────────

export type ConnectorCategory =
  | 'DATABASE'
  | 'ERP'
  | 'REST_API'
  | 'SOAP'
  | 'FTP_SFTP'
  | 'MESSAGING'
  | 'FILES'
  | 'WEBHOOK'
  | 'CUSTOM';

// ─── Connector ──────────────────────────────────────────────────────────────

export type ConnectorStatus = 'active' | 'beta' | 'deprecated';

export interface ConnectorRecord {
  id: string;
  /** Unique, URL-safe identifier — e.g. "postgresql", "sap-ecc". Immutable after creation. */
  identifier: string;
  name: string;
  category: ConnectorCategory;
  vendor: string;
  description: string;
  icon?: string;
  /** Denormalized from the latest published version, for cheap listing. */
  currentVersion: string | null;
  status: ConnectorStatus;
  /** Minimum compatible runtime version, semver-style (e.g. "1.4.0"). */
  minRuntimeVersion: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Versions ───────────────────────────────────────────────────────────────

export type ConnectorVersionStatus = 'stable' | 'beta';

export interface ConnectorVersionRecord {
  id: string;
  connectorId: string;
  /** Semver-style, e.g. "2.1.0". */
  version: string;
  changelog: string;
  status: ConnectorVersionStatus;
  minRuntimeVersion: string;
  /** Other connector identifiers (or arbitrary package names) this version depends on. */
  dependencies: string[];
  publishedAt: string;
  createdAt: string;
}

// ─── Parameters ─────────────────────────────────────────────────────────────

export type ParameterType = 'string' | 'number' | 'boolean' | 'secret' | 'enum' | 'url';

export interface ConnectorParameterRecord {
  id: string;
  connectorId: string;
  key: string;
  label: string;
  type: ParameterType;
  required: boolean;
  /** Never set when type === 'secret' — defaults for secrets don't make sense. */
  defaultValue?: string | number | boolean;
  /** Regex source, applied to string/secret/url values. */
  validationPattern?: string;
  /** Valid choices when type === 'enum'. */
  options?: string[];
  /** True for host/port/etc. that should render masked in the UI even though not a secret. */
  sensitive: boolean;
  /** Inter-parameter dependency: this field becomes required only when
   * another parameter equals a given value (e.g. "certificate" required
   * when "ssl" === true). */
  requiredIf?: { key: string; equals: string | number | boolean };
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface ConnectorTemplateRecord {
  id: string;
  connectorId: string;
  name: string;
  description?: string;
  /**
   * key → value for every non-secret parameter, applied verbatim.
   * Secret-typed parameter values are envelope-encrypted (see
   * modules/connectors/secret-crypto.ts) and only ever decrypted when a
   * template is actually applied to create a configured instance —
   * out of scope for this sprint, which stops at the registry/catalog.
   */
  values: Record<string, string | number | boolean>;
  encryptedValues: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorTemplateDTO {
  id: string;
  connectorId: string;
  name: string;
  description?: string;
  values: Record<string, string | number | boolean>;
  /** Keys present in encryptedValues, so the UI knows which fields are secret without ever seeing them. */
  secretKeys: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ConfigValidationIssue {
  key: string;
  message: string;
}
