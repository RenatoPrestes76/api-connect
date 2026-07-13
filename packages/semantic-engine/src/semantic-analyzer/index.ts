/**
 * @seltriva/semantic-engine/semantic-analyzer
 * Semantic Analyzer — infers business meaning from schema structure
 *
 * The analyzer is the "brain" of the USME. It examines a data structure
 * from multiple angles and produces semantic candidates:
 *
 *   NameAnalyzer     → what does the name suggest? (CODPROD → PRODUCT_CODE)
 *   StructureAnalyzer → what do the fields collectively suggest about the entity?
 *   RelationshipAnalyzer → what do the FK targets suggest?
 *   ContextAnalyzer  → what do neighboring entities suggest?
 *
 * Each analyzer produces candidates. The ConfidenceEngine aggregates their
 * signals into a final confidence score.
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
  SemanticResult,
} from '../business-language/index';
import type { ConfidenceValue, ConfidenceSignal } from '../confidence-engine/index';

// ─── Semantic Analyzer (top-level) ───────────────────────────────────────

export interface SemanticAnalyzer {
  /**
   * Analyze an entity and produce candidates for what CBL entity it maps to
   */
  analyzeEntity(input: EntityAnalysisInput): SemanticResult<EntityAnalysisOutput>;

  /**
   * Analyze a field and produce candidates for what CBL field it maps to
   */
  analyzeField(input: FieldAnalysisInput): SemanticResult<FieldAnalysisOutput>;

  /**
   * Analyze a complete schema and return candidates for every entity and field
   */
  analyzeSchema(input: SchemaAnalysisInput): SemanticResult<SchemaAnalysisOutput>;

  /**
   * Register a custom analyzer strategy
   */
  registerStrategy(strategy: AnalysisStrategy): void;

  /**
   * Get all active strategies
   */
  getStrategies(): AnalysisStrategy[];
}

// ─── Analysis Inputs ──────────────────────────────────────────────────────

export interface EntityAnalysisInput {
  readonly entityName: string;
  readonly originalName?: string;
  readonly fieldNames: string[];
  readonly fieldTypes?: Record<string, string>;
  readonly foreignKeyTargets?: string[];
  readonly namespace?: string;
  readonly erpProfileId?: string;
  readonly contextEntities?: string[];
  readonly options?: AnalysisOptions;
}

export interface FieldAnalysisInput {
  readonly fieldName: string;
  readonly originalName?: string;
  readonly nativeType?: string;
  readonly canonicalType?: string;
  readonly entityName?: string;
  readonly entityCblTerm?: CBLEntityTerm;
  readonly entityKind?: CBLEntityKind;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly isUnique?: boolean;
  readonly nullable?: boolean;
  readonly erpProfileId?: string;
  readonly position?: number;
  readonly options?: AnalysisOptions;
}

export interface SchemaAnalysisInput {
  readonly schemaName: string;
  readonly entities: EntityAnalysisInput[];
  readonly erpProfileId?: string;
  readonly options?: AnalysisOptions;
}

export interface AnalysisOptions {
  readonly maxCandidates?: number;
  readonly minConfidence?: number;
  readonly useGraphCoherence?: boolean;
  readonly useERPProfile?: boolean;
  readonly useLearningHistory?: boolean;
  readonly domains?: CBLDomainKind[];
}

// ─── Analysis Outputs ─────────────────────────────────────────────────────

export interface EntityAnalysisOutput {
  readonly entityName: string;
  readonly candidates: EntitySemanticCandidate[];
  readonly topCandidate: EntitySemanticCandidate | null;
  readonly fieldCandidates: Record<string, FieldSemanticCandidate[]>;
  readonly analysisSignals: AnalysisSignal[];
  readonly durationMs: number;
}

export interface FieldAnalysisOutput {
  readonly fieldName: string;
  readonly candidates: FieldSemanticCandidate[];
  readonly topCandidate: FieldSemanticCandidate | null;
  readonly analysisSignals: AnalysisSignal[];
  readonly durationMs: number;
}

export interface SchemaAnalysisOutput {
  readonly schemaName: string;
  readonly entityOutputs: EntityAnalysisOutput[];
  readonly totalCandidates: number;
  readonly highConfidenceCount: number;
  readonly unmappedCount: number;
  readonly durationMs: number;
}

// ─── Semantic Candidates ──────────────────────────────────────────────────

export interface EntitySemanticCandidate {
  readonly rank: number;
  readonly cblTerm: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly domain: CBLDomainKind;
  readonly confidence: ConfidenceValue;
  readonly confidencePercentage: number;
  readonly signals: ConfidenceSignal[];
  readonly explanation: string;
  readonly requiresValidation: boolean;
}

export interface FieldSemanticCandidate {
  readonly rank: number;
  readonly cblTerm: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;
  readonly domain: CBLDomainKind;
  readonly confidence: ConfidenceValue;
  readonly confidencePercentage: number;
  readonly signals: ConfidenceSignal[];
  readonly explanation: string;
  readonly requiresValidation: boolean;
}

// ─── Analysis Signal ──────────────────────────────────────────────────────

/**
 * A diagnostic signal explaining what drove the analysis result.
 */
export interface AnalysisSignal {
  readonly source: AnalysisStrategyId;
  readonly description: string;
  readonly weight: ConfidenceValue;
  readonly details?: string[];
}

// ─── Analysis Strategies ──────────────────────────────────────────────────

export type AnalysisStrategyId =
  | 'name-analyzer'
  | 'structure-analyzer'
  | 'relationship-analyzer'
  | 'context-analyzer'
  | 'type-analyzer'
  | 'pattern-analyzer'
  | 'erp-profile-analyzer'
  | 'learning-analyzer';

export interface AnalysisStrategy {
  readonly id: AnalysisStrategyId;
  readonly name: string;
  readonly description: string;
  readonly defaultWeight: ConfidenceValue;
  readonly scope: 'entity' | 'field' | 'both';

  analyzeEntity?(input: EntityAnalysisInput): AnalysisSignal[];
  analyzeField?(input: FieldAnalysisInput): AnalysisSignal[];
}

// ─── Name Analyzer ────────────────────────────────────────────────────────

/**
 * Analyzes raw field and entity names to produce semantic candidates.
 * Handles abbreviations, prefixes, naming conventions, multilingual names.
 */
export interface NameAnalyzer extends AnalysisStrategy {
  readonly id: 'name-analyzer';

  /**
   * Normalize a raw name: strip prefixes/suffixes, split camelCase/snake_case,
   * expand abbreviations, translate from Portuguese/Spanish/German common ERP terms.
   */
  normalizeName(name: string, context?: NormalizationHint): NormalizedName;

  /**
   * Match a normalized name against the CBL vocabulary
   */
  matchToCBL(normalized: NormalizedName): NameMatchResult[];

  /**
   * Register an abbreviation expansion
   */
  registerAbbreviation(abbrev: string, expansion: string): void;

  /**
   * Register a multilingual synonym
   */
  registerSynonym(foreign: string, cblAlias: string, language?: string): void;
}

export interface NormalizationHint {
  readonly erpProfileId?: string;
  readonly language?: string;
  readonly stripPrefix?: boolean;
  readonly stripSuffix?: boolean;
}

export interface NormalizedName {
  readonly original: string;
  readonly normalized: string;
  readonly tokens: string[];
  readonly expandedTokens: string[];
  readonly detectedConvention?: string;
  readonly strippedPrefix?: string;
  readonly strippedSuffix?: string;
  readonly language?: string;
}

export interface NameMatchResult {
  readonly cblTerm: CBLEntityTerm | CBLFieldTerm;
  readonly matchedAlias: string;
  readonly similarity: ConfidenceValue;
  readonly matchKind: 'exact' | 'alias' | 'synonym' | 'partial' | 'heuristic';
}

// ─── Structure Analyzer ───────────────────────────────────────────────────

/**
 * Analyzes the structural properties of an entity (field count, field types,
 * constraint patterns) to infer what business concept it represents.
 */
export interface StructureAnalyzer extends AnalysisStrategy {
  readonly id: 'structure-analyzer';

  /**
   * Score how well a set of fields matches the expected structure for an entity kind
   */
  scoreEntityStructure(fieldNames: string[], entityKind: CBLEntityKind): ConfidenceValue;

  /**
   * Given field names, suggest which entity kinds best fit
   */
  suggestEntityKinds(fieldNames: string[]): Array<{ kind: CBLEntityKind; score: ConfidenceValue }>;
}

// ─── Relationship Analyzer ────────────────────────────────────────────────

/**
 * Analyzes FK relationships to infer entity semantics.
 * If an entity has a FK to a table mapped to ENTITY_PRODUCT and another to
 * ENTITY_WAREHOUSE, it might be ENTITY_INVENTORY.
 */
export interface RelationshipAnalyzer extends AnalysisStrategy {
  readonly id: 'relationship-analyzer';

  /**
   * Given FK targets (already mapped to CBL entities), suggest what the
   * source entity might be.
   */
  suggestFromFKTargets(
    fkTargetKinds: CBLEntityKind[]
  ): Array<{ entityKind: CBLEntityKind; score: ConfidenceValue; reason: string }>;
}

// ─── Context Analyzer ────────────────────────────────────────────────────

/**
 * Analyzes the neighborhood of an entity within its schema to produce
 * domain-level context. If most entities in the schema are mapped to
 * commerce/inventory domains, an unmapped entity is likely also commerce/inventory.
 */
export interface ContextAnalyzer extends AnalysisStrategy {
  readonly id: 'context-analyzer';

  /**
   * Infer the dominant domain from a set of already-mapped entity kinds
   */
  inferDomain(mappedEntityKinds: CBLEntityKind[]): CBLDomainKind;

  /**
   * Score a candidate based on whether its domain matches the schema's context
   */
  scoreDomainFit(candidateKind: CBLEntityKind, contextDomain: CBLDomainKind): ConfidenceValue;
}
