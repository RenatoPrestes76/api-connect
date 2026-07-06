/**
 * @seltriva/semantic-engine
 * Universal Semantic Mapping Engine (USME) — public API surface
 *
 * Import from sub-paths for tree-shaking:
 *   import type { CBLEntityKind } from '@seltriva/semantic-engine/business-language'
 *
 * Import from root for convenience:
 *   import type { CBLEntityKind, SemanticMapping } from '@seltriva/semantic-engine'
 */

// ─── 1. Business Language — CBL vocabulary ────────────────────────────────
export type {
  SemanticResult,
  SemanticError,
  SemanticErrorCode,
  CBLTerm,
  CBLEntityTerm,
  CBLFieldTerm,
  CBLRelationshipTerm,
  CBLDomain,
  CBLEntityKind,
  CBLFieldKind,
  CBLRelationshipKind,
  CBLDomainKind,
  CBLConcept,
  CBLRegistry,
} from './business-language/index';

export {
  CBL_ENTITY_DOMAINS,
  cblEntityTerm,
  cblFieldTerm,
  cblRelTerm,
  parseCBLEntityTerm,
  parseCBLFieldTerm,
} from './business-language/index';

// ─── 2. Canonical Model — CBM output types ────────────────────────────────
export type {
  CanonicalBusinessModel,
  CBMStatistics,
  CBMEntity,
  CBMField,
  CBMRelationship,
  CBMCardinality,
  MappingStatus,
  CBMBuilder,
  CBMBuildSession,
  CBMStore,
  CBMListOptions,
  CBMSummary,
  CBMSnapshot,
  CBMSnapshotStore,
  CBMDiff,
} from './canonical-model/index';

// ─── 3. Confidence Engine — scoring ───────────────────────────────────────
export type {
  ConfidenceValue,
  ConfidenceTier,
  ConfidenceEngine,
  ConfidenceInput,
  ConfidenceRankingInput,
  FieldMappingCandidate,
  ConfidenceScore,
  RankedConfidenceScore,
  ScoredSignal,
  ConfidenceSignalProvider,
  ConfidenceSignal,
  ConfidenceWeights,
  ConfidenceThresholds,
  ConfidenceAggregator,
  EntityConfidenceReport,
  FieldConfidenceScore,
} from './confidence-engine/index';

export {
  SIGNAL_IDS,
  DEFAULT_CONFIDENCE_WEIGHTS,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from './confidence-engine/index';

// ─── 4. Dictionary — business definitions ────────────────────────────────
export type {
  BusinessDictionary,
  DictionaryEntry,
  EntityDefinition,
  FieldDefinition,
  EntityExample,
  FieldExample,
  FieldFormatConstraint,
  RelationshipHint,
  BusinessRuleReference,
  DictionaryBuilder,
  EntityDefinitionBuilder,
  FieldDefinitionBuilder,
  DictionarySearchResult,
  DictionaryExporter,
} from './dictionary/index';

// ─── 5. Knowledge Graph — business concept relationships ──────────────────
export type {
  BusinessKnowledgeGraph,
  GraphNode,
  GraphEdge,
  ExpectedField,
  FieldExpectation,
  ExpectedRelationship,
  RelatedEntityResult,
  EntityFieldAssociation,
  GraphCoherenceScore,
  MissingExpectedField,
  GraphTraversalOptions,
  GraphPath,
  GraphPredicate,
  GraphQueryResult,
  GraphStatistics,
  KnowledgeGraphAnalyzer,
  GraphCluster,
} from './knowledge-graph/index';

// ─── 6. Semantic Analyzer — analysis strategies ──────────────────────────
export type {
  SemanticAnalyzer,
  EntityAnalysisInput,
  FieldAnalysisInput,
  SchemaAnalysisInput,
  AnalysisOptions,
  EntityAnalysisOutput,
  FieldAnalysisOutput,
  SchemaAnalysisOutput,
  EntitySemanticCandidate,
  FieldSemanticCandidate,
  AnalysisSignal,
  AnalysisStrategyId,
  AnalysisStrategy,
  NameAnalyzer,
  NormalizationHint,
  NormalizedName,
  NameMatchResult,
  StructureAnalyzer,
  RelationshipAnalyzer,
  ContextAnalyzer,
} from './semantic-analyzer/index';

// ─── 7. Suggestions — packaged proposals ─────────────────────────────────
export type {
  SuggestionEngine,
  SuggestionOptions,
  SuggestionBundle,
  BundleStatus,
  SemanticSuggestion,
  EntitySuggestion,
  EntityAlternative,
  EntityDefinitionPreview,
  FieldSuggestion,
  FieldAlternative,
  FieldDefinitionPreview,
  SuggestionStatus,
  RejectionFeedback,
  RejectionReason,
  SuggestionStore,
  SuggestionListOptions,
  SuggestionPrioritizer,
  SuggestionFormatter,
  FormattedSuggestion,
  FormattedBundle,
} from './suggestions/index';

// ─── 8. Mapping Engine — orchestration ───────────────────────────────────
export type {
  SemanticMappingEngine,
  MappingSessionInput,
  EntityMappingInput,
  FieldMappingInput,
  MappingOptions,
  MappingSession,
  MappingSessionStatus,
  MappingSessionStatistics,
  MappingSessionResult,
  FinalizeOptions,
  SemanticMapping,
  SemanticMappingStore,
  MappingEvent,
  MappingEventKind,
  MappingEventStore,
  BatchMappingEngine,
  BatchMappingResult,
  BatchProgress,
} from './mapping-engine/index';

// ─── 9. Validation — human approval workflow ──────────────────────────────
export type {
  ValidationWorkflow,
  ValidationRequest,
  ValidationStatus,
  ValidationDecision,
  ConfirmDecision,
  RejectDecision,
  ModifyDecision,
  ValidationOutcome,
  BulkDecisionResult,
  ValidationRecord,
  ValidationQueueFilter,
  ValidationHistoryFilter,
  ValidationQueue,
  ValidationStatistics,
  ValidationStatisticsProvider,
  ValidationNotifier,
} from './validation/index';

// ─── 10. Learning — semantic pattern learning ─────────────────────────────
export type {
  SemanticLearner,
  LearningSession,
  LearningOutcome,
  BatchLearningOutcome,
  LearningPattern,
  LearningPatternKind,
  LearningPatternPayload,
  ExactNamePattern,
  NamePrefixPattern,
  NameSuffixPattern,
  NameContainsPattern,
  AbbreviationPattern,
  MultilingualSynonymPattern,
  StructuralSignaturePattern,
  ERPConventionPattern,
  FieldCooccurrencePattern,
  LearningMemory,
  PatternQueryOptions,
  PatternFilter,
  LearningMemoryStats,
  PatternExtractor,
} from './learning/index';

// ─── 11. Profiles — ERP semantic profiles ────────────────────────────────
export type {
  ERPSemanticProfile,
  ERPProfileId,
  ERPEntityMapping,
  ERPFieldMapping,
  ERPNamingPattern,
  ERPProfileRegistry,
  ProfileMatcher,
  ProfileMatchResult,
  ProfileLearner,
  ProfileConfidenceBooster,
  ProfileSerializer,
} from './profiles/index';

export { KNOWN_ERP_PROFILES } from './profiles/index';

// ─── 12. Rules — business rule engine ────────────────────────────────────
export type {
  BusinessRuleEngine,
  BusinessRule,
  RuleSeverity,
  RuleScope,
  RuleApplicability,
  RuleEvaluationContext,
  RuleViolation,
  RuleEvaluationResult,
  ModelRuleReport,
  MappingConstraint,
  MappingConstraintKind,
  BusinessRuleRegistry,
} from './rules/index';

export { MAPPING_RULE_IDS } from './rules/index';

// ─── 13. Registry — confirmed mappings store ─────────────────────────────
export type {
  SemanticMappingRegistry,
  RegistryEntry,
  RegistryLookupContext,
  RegistryLookupResult,
  RegistrySearchCriteria,
  RegistryListOptions,
  RegistryExportFormat,
  RegistryStatistics,
  RegistryStatsProvider,
  RegistryEvent,
  RegistryObserver,
} from './registry/index';
