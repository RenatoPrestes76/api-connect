/**
 * @seltriva/semantic-engine/registry
 * Semantic Mapping Registry — authoritative store of all confirmed mappings
 *
 * The registry is the single source of truth for semantic mappings.
 * It is read by:
 * - The ConfidenceEngine (to boost scores for previously confirmed names)
 * - The LearningEngine (to feed patterns back)
 * - The MappingEngine (to pre-populate sessions)
 * - External systems (to query "what does this column mean?")
 *
 * The registry is append-only — revoked mappings are marked as revoked,
 * not deleted, preserving the audit trail.
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
  SemanticResult,
} from '../business-language/index';
import type { ConfidenceValue } from '../confidence-engine/index';
import type { SemanticMapping } from '../mapping-engine/index';
import type { MappingStatus } from '../canonical-model/index';

// ─── Semantic Mapping Registry ────────────────────────────────────────────

export interface SemanticMappingRegistry {
  /**
   * Add a confirmed mapping to the registry
   */
  register(mapping: SemanticMapping): Promise<SemanticResult<string>>;

  /**
   * Update an existing mapping (e.g., when a revision is confirmed)
   */
  update(mappingId: string, updates: Partial<SemanticMapping>): Promise<SemanticResult<void>>;

  /**
   * Revoke a mapping without deleting it
   */
  revoke(mappingId: string, revokedBy: string, reason?: string): Promise<SemanticResult<void>>;

  /**
   * Look up the confirmed CBL term for an entity name
   */
  resolveEntity(
    entityName: string,
    context?: RegistryLookupContext
  ): Promise<SemanticResult<RegistryLookupResult<CBLEntityTerm> | null>>;

  /**
   * Look up the confirmed CBL term for a field name
   */
  resolveField(
    fieldName: string,
    entityName?: string,
    context?: RegistryLookupContext
  ): Promise<SemanticResult<RegistryLookupResult<CBLFieldTerm> | null>>;

  /**
   * Find all known source names that map to a given CBL entity term
   */
  reverseEntityLookup(term: CBLEntityTerm): Promise<SemanticResult<string[]>>;

  /**
   * Find all known source names that map to a given CBL field term
   */
  reverseFieldLookup(term: CBLFieldTerm): Promise<SemanticResult<string[]>>;

  /**
   * Search registry entries by criteria
   */
  search(criteria: RegistrySearchCriteria): Promise<SemanticResult<RegistryEntry[]>>;

  /**
   * List all entries (with pagination)
   */
  list(options?: RegistryListOptions): Promise<SemanticResult<RegistryEntry[]>>;

  /**
   * Get a mapping by its registry ID
   */
  getById(id: string): Promise<SemanticResult<RegistryEntry | null>>;

  /**
   * Count entries
   */
  count(filter?: RegistryListOptions): Promise<number>;

  /**
   * Export registry to a portable format
   */
  export(format?: RegistryExportFormat): Promise<SemanticResult<string>>;
}

// ─── Registry Entry ───────────────────────────────────────────────────────

/**
 * A registry entry wraps a SemanticMapping with registry-specific metadata.
 */
export interface RegistryEntry {
  readonly registryId: string;
  readonly mapping: SemanticMapping;
  readonly status: MappingStatus;
  readonly revokedAt?: Date;
  readonly revokedBy?: string;
  readonly revocationReason?: string;
  readonly registeredAt: Date;
  readonly lastConfirmedAt: Date;
  readonly confirmationCount: number;
}

// ─── Registry Lookup ──────────────────────────────────────────────────────

export interface RegistryLookupContext {
  readonly erpProfileId?: string;
  readonly schemaId?: string;
  readonly domain?: CBLDomainKind;
}

export interface RegistryLookupResult<TTerm extends CBLEntityTerm | CBLFieldTerm> {
  readonly term: TTerm;
  readonly registryId: string;
  readonly confidence: ConfidenceValue;
  readonly confirmedAt: Date;
  readonly confirmedBy?: string;
  readonly source: 'registry' | 'profile' | 'learning';
}

// ─── Registry Search ──────────────────────────────────────────────────────

export interface RegistrySearchCriteria {
  readonly sourceName?: string;
  readonly sourceNamePattern?: string;
  readonly cblTerm?: CBLEntityTerm | CBLFieldTerm;
  readonly entityKind?: CBLEntityKind;
  readonly fieldKind?: CBLFieldKind;
  readonly domain?: CBLDomainKind;
  readonly erpProfileId?: string;
  readonly schemaId?: string;
  readonly status?: MappingStatus;
  readonly minConfidence?: ConfidenceValue;
  readonly confirmedBy?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface RegistryListOptions {
  readonly kind?: 'entity' | 'field';
  readonly status?: MappingStatus;
  readonly domain?: CBLDomainKind;
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: 'registeredAt' | 'confidence' | 'sourceName' | 'cblTerm';
  readonly orderDir?: 'asc' | 'desc';
}

// ─── Registry Export ──────────────────────────────────────────────────────

export type RegistryExportFormat = 'json' | 'csv' | 'markdown';

// ─── Registry Statistics ──────────────────────────────────────────────────

export interface RegistryStatistics {
  readonly totalMappings: number;
  readonly entityMappings: number;
  readonly fieldMappings: number;
  readonly activeMappings: number;
  readonly revokedMappings: number;
  readonly byDomain: Record<CBLDomainKind, number>;
  readonly byEntityKind: Partial<Record<CBLEntityKind, number>>;
  readonly byFieldKind: Partial<Record<CBLFieldKind, number>>;
  readonly profileCount: number;
  readonly averageConfidence: ConfidenceValue;
  readonly lastRegisteredAt?: Date;
}

export interface RegistryStatsProvider {
  getStatistics(): Promise<RegistryStatistics>;
  getStatisticsByProfile(erpProfileId: string): Promise<RegistryStatistics>;
}

// ─── Registry Observer ───────────────────────────────────────────────────

export interface RegistryEvent {
  readonly type: 'registered' | 'updated' | 'revoked';
  readonly registryId: string;
  readonly mapping: SemanticMapping;
  readonly timestamp: Date;
}

export interface RegistryObserver {
  onChange(handler: (event: RegistryEvent) => void): string;
  offChange(subscriptionId: string): void;
}
