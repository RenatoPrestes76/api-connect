/**
 * @seltriva/semantic-engine/profiles
 * ERP Semantic Profiles — accumulated semantic knowledge per ERP system
 *
 * Each ERP (SAP, TOTVS, Oracle EBS, Microsoft Dynamics, etc.) has its own
 * naming conventions. TOTVS uses `CODPROD` for product code; SAP uses `MATNR`.
 * Both map to FIELD_PRODUCT_CODE in the CBL.
 *
 * A profile stores:
 * - Known field name → CBL term mappings for this ERP
 * - Known entity name → CBL entity mappings
 * - Naming conventions (prefix/suffix patterns)
 * - Confidence boosters (when we're in a SAP context, MATNR confidence → 100%)
 *
 * Profiles are built incrementally through the learning engine.
 * They are the main mechanism by which USME becomes "smarter" over time
 * for specific ERP ecosystems.
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

// ─── ERP Profile ──────────────────────────────────────────────────────────

export interface ERPSemanticProfile {
  readonly id: ERPProfileId;
  readonly erpName: string;
  readonly vendor: string;
  readonly product: string;
  readonly version?: string;
  readonly modules?: string[];
  readonly description: string;
  readonly entityMappings: ERPEntityMapping[];
  readonly fieldMappings: ERPFieldMapping[];
  readonly namingPatterns: ERPNamingPattern[];
  readonly prefixes: string[];
  readonly suffixes: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly learnedMappingCount: number;
  readonly metadata?: Record<string, unknown>;
}

export type ERPProfileId = string & { readonly __brand: 'ERPProfileId' };

// ─── ERP Mappings ─────────────────────────────────────────────────────────

export interface ERPEntityMapping {
  readonly erpTableName: string;
  readonly tableNamePattern?: RegExp;
  readonly cblTerm: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly confidence: ConfidenceValue;
  readonly isLearned: boolean;
  readonly observedCount: number;
  readonly module?: string;
  readonly notes?: string;
}

export interface ERPFieldMapping {
  readonly erpColumnName: string;
  readonly columnNamePattern?: RegExp;
  readonly cblTerm: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;
  readonly confidence: ConfidenceValue;
  readonly applicableEntities?: CBLEntityKind[];
  readonly isLearned: boolean;
  readonly observedCount: number;
  readonly module?: string;
  readonly notes?: string;
}

// ─── Naming Patterns ─────────────────────────────────────────────────────

export interface ERPNamingPattern {
  readonly id: string;
  readonly scope: 'entity' | 'field' | 'both';
  readonly pattern: string;
  readonly isPrefix: boolean;
  readonly isSuffix: boolean;
  readonly isStripped: boolean;
  readonly examples: string[];
  readonly frequency: number;
}

// ─── Known ERP Profiles ───────────────────────────────────────────────────

/**
 * IDs for built-in ERP profiles.
 */
export const KNOWN_ERP_PROFILES = {
  SAP_ECC:                  'erp-sap-ecc',
  SAP_S4HANA:               'erp-sap-s4hana',
  SAP_B1:                   'erp-sap-b1',
  TOTVS_PROTHEUS:           'erp-totvs-protheus',
  TOTVS_RM:                 'erp-totvs-rm',
  ORACLE_EBS:               'erp-oracle-ebs',
  ORACLE_FUSION:            'erp-oracle-fusion',
  MICROSOFT_DYNAMICS_365:   'erp-ms-dynamics-365',
  MICROSOFT_DYNAMICS_NAV:   'erp-ms-dynamics-nav',
  MICROSOFT_DYNAMICS_AX:    'erp-ms-dynamics-ax',
  NETSUITE:                 'erp-netsuite',
  SAGE_X3:                  'erp-sage-x3',
  INFOR_M3:                 'erp-infor-m3',
  EPICOR:                   'erp-epicor',
  LINX:                     'erp-linx',
  SENIOR:                   'erp-senior',
  OMIE:                     'erp-omie',
  BLING:                    'erp-bling',
  TINY_ERP:                 'erp-tiny',
  GENERIC:                  'erp-generic',
} as const;

export type KnownERPProfileId = (typeof KNOWN_ERP_PROFILES)[keyof typeof KNOWN_ERP_PROFILES];

// ─── Profile Registry ─────────────────────────────────────────────────────

export interface ERPProfileRegistry {
  /**
   * Register a profile (built-in or learned)
   */
  register(profile: ERPSemanticProfile): void;

  /**
   * Get a profile by ID
   */
  get(profileId: ERPProfileId): ERPSemanticProfile | null;

  /**
   * List all profiles
   */
  getAll(): ERPSemanticProfile[];

  /**
   * Get profiles for a specific vendor
   */
  getByVendor(vendor: string): ERPSemanticProfile[];

  /**
   * Remove a profile
   */
  unregister(profileId: ERPProfileId): void;

  /**
   * Check if a profile exists
   */
  has(profileId: ERPProfileId): boolean;
}

// ─── Profile Matcher ──────────────────────────────────────────────────────

/**
 * Detects which ERP profile best matches an unknown schema.
 */
export interface ProfileMatcher {
  /**
   * Score a schema against all registered profiles
   */
  match(
    entityNames: string[],
    fieldNames: string[]
  ): SemanticResult<ProfileMatchResult[]>;

  /**
   * Find the best-matching profile
   */
  findBest(
    entityNames: string[],
    fieldNames: string[]
  ): SemanticResult<ProfileMatchResult | null>;
}

export interface ProfileMatchResult {
  readonly profile: ERPSemanticProfile;
  readonly score: ConfidenceValue;
  readonly matchedEntityCount: number;
  readonly matchedFieldCount: number;
  readonly evidence: string[];
}

// ─── Profile Learner ──────────────────────────────────────────────────────

/**
 * Accumulates confirmed mappings into a profile.
 */
export interface ProfileLearner {
  /**
   * Record a confirmed entity mapping for a profile
   */
  learnEntityMapping(
    profileId: ERPProfileId,
    erpTableName: string,
    cblTerm: CBLEntityTerm
  ): Promise<SemanticResult<void>>;

  /**
   * Record a confirmed field mapping for a profile
   */
  learnFieldMapping(
    profileId: ERPProfileId,
    erpColumnName: string,
    cblTerm: CBLFieldTerm,
    entityKind?: CBLEntityKind
  ): Promise<SemanticResult<void>>;

  /**
   * Discover and record naming patterns from confirmed mappings
   */
  discoverPatterns(profileId: ERPProfileId): Promise<SemanticResult<ERPNamingPattern[]>>;

  /**
   * Merge knowledge from one profile into another
   */
  mergeProfiles(
    sourceId: ERPProfileId,
    targetId: ERPProfileId
  ): Promise<SemanticResult<ERPSemanticProfile>>;
}

// ─── Profile Confidence Booster ───────────────────────────────────────────

/**
 * When a schema is identified as belonging to a specific ERP,
 * this boosts confidence scores for names known by that profile.
 */
export interface ProfileConfidenceBooster {
  /**
   * Returns a confidence boost (0–1 additive) for a known ERP name mapping
   */
  boost(
    sourceName: string,
    profileId: ERPProfileId,
    candidateTerm: CBLEntityTerm | CBLFieldTerm
  ): ConfidenceValue;

  /**
   * Returns true if the name is explicitly known in the profile
   */
  isKnown(sourceName: string, profileId: ERPProfileId): boolean;
}

// ─── Profile Export / Import ──────────────────────────────────────────────

export interface ProfileSerializer {
  serialize(profile: ERPSemanticProfile): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): SemanticResult<ERPSemanticProfile>;
  toContribFile(profiles: ERPSemanticProfile[]): string;
}
