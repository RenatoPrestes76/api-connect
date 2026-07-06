/**
 * @seltriva/governance — configuration
 * Governance configuration management: platform config, org overrides, schema enforcement.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type GovernanceConfigId = Branded<string, 'GovernanceConfigId'>;

export type ConfigScope = 'platform' | 'organization' | 'workspace' | 'environment';
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret';
export type ConfigChangeSource = 'admin-ui' | 'api' | 'cli' | 'policy' | 'migration' | 'default';

export interface GovernanceConfigEntry {
  readonly id: GovernanceConfigId;
  readonly scope: ConfigScope;
  readonly scopeId?: string;               // orgId, workspaceId, etc.
  readonly key: string;
  readonly value: unknown;
  readonly type: ConfigValueType;
  readonly schema?: ConfigSchema;
  readonly encrypted: boolean;
  readonly overridable: boolean;           // can child scopes override?
  readonly source: ConfigChangeSource;
  readonly version: number;
  readonly setBy: string;
  readonly setAt: Date;
  readonly expiresAt?: Date;
  readonly description?: string;
}

export interface ConfigSchema {
  readonly type: ConfigValueType;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly validation?: ConfigValidation;
  readonly allowedValues?: unknown[];
}

export interface ConfigValidation {
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface GovernanceConfigHistory {
  readonly key: string;
  readonly scope: ConfigScope;
  readonly scopeId?: string;
  readonly entries: ConfigHistoryEntry[];
}

export interface ConfigHistoryEntry {
  readonly version: number;
  readonly value: unknown;
  readonly setBy: string;
  readonly setAt: Date;
  readonly source: ConfigChangeSource;
  readonly reason?: string;
}

export interface IGovernanceConfigService {
  get<T = unknown>(scope: ConfigScope, scopeId: string | undefined, key: string): Promise<T | null>;
  getAll(scope: ConfigScope, scopeId?: string): Promise<GovernanceConfigEntry[]>;
  set(input: SetConfigInput): Promise<GovernanceResult<GovernanceConfigEntry>>;
  delete(scope: ConfigScope, scopeId: string | undefined, key: string, by: string): Promise<GovernanceResult<void>>;
  getResolved(scope: ConfigScope, scopeId: string): Promise<Record<string, unknown>>;
  getHistory(scope: ConfigScope, scopeId: string | undefined, key: string): Promise<GovernanceConfigHistory>;
  rollback(scope: ConfigScope, scopeId: string | undefined, key: string, toVersion: number, by: string): Promise<GovernanceResult<void>>;
}

export interface SetConfigInput {
  readonly scope: ConfigScope;
  readonly scopeId?: string;
  readonly key: string;
  readonly value: unknown;
  readonly type: ConfigValueType;
  readonly encrypted?: boolean;
  readonly overridable?: boolean;
  readonly setBy: string;
  readonly source?: ConfigChangeSource;
  readonly reason?: string;
  readonly expiresAt?: Date;
}
