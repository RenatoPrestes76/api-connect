import type { VersionRange } from './version.js';

export type ConnectorCategory = 'database' | 'erp' | 'api' | 'file' | 'cloud' | 'queue' | 'custom';

export type ConnectorPermission =
  | 'network:outbound'
  | 'network:inbound'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'credentials:read'
  | 'config:read'
  | 'events:emit'
  | 'scheduler:register';

export interface ConnectorCapabilities {
  readonly canDiscover: boolean;
  readonly canSynchronize: boolean;
  readonly canValidate: boolean;
  readonly canStream: boolean;
  readonly canBulkWrite: boolean;
  readonly supportsSSL: boolean;
}

export interface ConnectorDependency {
  readonly id: string;
  readonly version: VersionRange;
  readonly optional: boolean;
}

export interface ConnectorMetadata {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly sdkVersion: string;
  readonly vendor: string;
  readonly category: ConnectorCategory;
  readonly description: string;
  readonly compatibility: VersionRange;
  readonly dependencies: ConnectorDependency[];
  readonly permissions: ConnectorPermission[];
  readonly capabilities: ConnectorCapabilities;
  readonly updatable: boolean;
  readonly homepage?: string;
}
