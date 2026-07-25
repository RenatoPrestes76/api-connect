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

export type ConnectorStatus = 'active' | 'beta' | 'deprecated';

export interface RegistryConnector {
  id: string;
  identifier: string;
  name: string;
  category: ConnectorCategory;
  vendor: string;
  description: string;
  icon?: string;
  currentVersion: string | null;
  status: ConnectorStatus;
  minRuntimeVersion: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorVersionStatus = 'stable' | 'beta';

export interface RegistryConnectorVersion {
  id: string;
  connectorId: string;
  version: string;
  changelog: string;
  status: ConnectorVersionStatus;
  minRuntimeVersion: string;
  dependencies: string[];
  publishedAt: string;
  createdAt: string;
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'secret' | 'enum' | 'url';

export interface RegistryConnectorParameter {
  id: string;
  connectorId: string;
  key: string;
  label: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: string | number | boolean;
  validationPattern?: string;
  options?: string[];
  sensitive: boolean;
  description?: string;
  order: number;
  requiredIf?: { key: string; equals: string | number | boolean };
  createdAt: string;
  updatedAt: string;
}

export interface RegistryConnectorTemplate {
  id: string;
  connectorId: string;
  name: string;
  description?: string;
  values: Record<string, string | number | boolean>;
  secretKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConfigValidationIssue {
  key: string;
  message: string;
}
