/**
 * @seltriva/schema-intelligence
 * Schema Intelligence Engine (SIE) — public API surface
 *
 * Import from sub-paths for tree-shaking:
 *   import type { CanonicalSchema } from '@seltriva/schema-intelligence/canonical'
 *
 * Import from the root for convenience in application code:
 *   import type { CanonicalSchema, SIEResult } from '@seltriva/schema-intelligence'
 */

// ─── 1. Models — foundational vocabulary ─────────────────────────────────
export type {
  SchemaId,
  EntityId,
  FieldId,
  RelationshipId,
  VersionId,
  FingerprintId,
  PatternId,
  SchemaSourceType,
  SchemaCategory,
  CanonicalDataKind,
  NamingConvention,
  FieldRole,
  EntityKind,
  RelationshipKind,
  ConstraintKind,
  Cardinality,
  ChangeSeverity,
  ConfidenceScore,
  SimilarityScore,
  SqlDialect,
  OpenApiVersion,
  GraphQLVersion,
} from './models/index';

// ─── 2. Core — result wrapper, source descriptor, base interfaces ─────────
export type {
  SIEResult,
  SIEError,
  SIEErrorCode,
  SchemaSource,
  ParseContext,
  NormalizationContext,
  NormalizationOptions,
  RawSchema,
  RawEntity,
  RawField,
  RawConstraint,
  RawReference,
  RawEnumeration,
  ParseWarning,
  SchemaIntelligenceEngine,
  ProcessedSchema,
  ComparisonSummary,
  SchemaVersionRef,
  SchemaTimelineSummary,
} from './core/index';

// ─── 3. Canonical — universal schema model ───────────────────────────────
export type {
  CanonicalSchema,
  SchemaStatistics,
  CanonicalEntity,
  PrimaryKeyDescriptor,
  CanonicalField,
  CanonicalType,
  CanonicalConstraint,
  ReferentialAction,
  CanonicalIndex,
  CanonicalIndexField,
  CanonicalRelationship,
  CanonicalEnumeration,
  CanonicalEnumValue,
  CanonicalValue,
  SchemaPatch,
  PatchOperation,
  AddEntityOperation,
  RemoveEntityOperation,
  AddFieldOperation,
  RemoveFieldOperation,
  ModifyFieldOperation,
  AddRelationshipOperation,
  RemoveRelationshipOperation,
} from './canonical/index';

// ─── 4. Parser — schema parsers ──────────────────────────────────────────
export type {
  SchemaParser,
  ParserValidationResult,
  ParserValidationError,
  ParserValidationWarning,
  DetectionResult,
  SqlDdlParser,
  SqlParserOptions,
  SqlStatementResult,
  SqlFieldDescriptor,
  SqlConstraintDescriptor,
  SqlReferenceDescriptor,
  OpenApiParser,
  OpenApiParserOptions,
  OpenApiSchemaMap,
  OpenApiSchemaDefinition,
  GraphQLSchemaParser,
  GraphQLParserOptions,
  GraphQLTypeMap,
  GraphQLTypeDef,
  GraphQLFieldDef,
  GraphQLArgDef,
  GraphQLEnumDef,
  GraphQLUnionDef,
  GraphQLDirectiveDef,
  GraphQLInferredRelationship,
  CsvSchemaParser,
  CsvParserOptions,
  CsvHeaderResult,
  CsvColumnDescriptor,
  CsvTypeInferenceOptions,
  CsvTypeInferenceResult,
  CsvInferredColumn,
  JsonSchemaParser,
  JsonParserOptions,
  JsonSchemaDraft,
  XmlSchemaParser,
  XmlParserOptions,
  XsdImportResolver,
  SchemaParserRegistry,
  ParserDetectionRanking,
} from './parser/index';

// ─── 5. Normalizer — raw → canonical pipeline ────────────────────────────
export type {
  SchemaNormalizer,
  NormalizationPipeline,
  NormalizationStep,
  NormalizationState,
  NormalizationWarning,
  EntityNormalizer,
  FieldNormalizer,
  TypeNormalizer,
  TypeConstraints,
  NamingConventionDetector,
  FieldRoleInferenceEngine,
  FieldRoleInferenceResult,
  FieldRolePattern,
  RelationshipInferrer,
  InferredRelationship,
  InferredRelationshipCandidate,
  RelationshipInferenceBasis,
  TypeNormalizerRegistry,
} from './normalizer/index';

// ─── 6. Comparator — structural diff ─────────────────────────────────────
export type {
  SchemaComparator,
  SchemaDiff,
  DiffSummary,
  EntityDiff,
  FieldDiff,
  TypeChange,
  NullabilityChange,
  DefaultValueChange,
  RequiredChange,
  RoleChange,
  StringChange,
  ConstraintDiff,
  IndexDiff,
  RenameDetection,
  RenameEvidence,
  BreakingChangeClassifier,
  BreakingChange,
  BreakingChangeCategory,
  BreakingChangeRule,
  RenameDetector,
  RenameDetectionOptions,
  RenameWeights,
} from './comparator/index';

// ─── 7. Detector — change detection engine ───────────────────────────────
export type {
  ChangeDetectionEngine,
  DetectionOptions,
  ChangeDetectionReport,
  ChangeDetectionSummary,
  EvolutionEvent,
  EvolutionEventKind,
  MappingSuggestion,
  MappingSuggestionKind,
  ImpactAssessment,
  RiskLevel,
  SchemaEvolutionTracker,
  BreakingChangeAdvisor,
  BreakingChangeAdvice,
  FieldEvolutionPattern,
} from './detector/index';

// ─── 8. Versioning — schema version history ──────────────────────────────
export type {
  SchemaVersion,
  SchemaVersionStore,
  VersionListOptions,
  SchemaVersionSummary,
  SchemaVersionHistory,
  SchemaTimeline,
  TimelineEvent,
  TimelineEventKind,
  TimelineBranch,
  VersionTagger,
  SnapshotReconstructor,
  VersionComparator,
} from './versioning/index';

// ─── 9. Registry — schema + ERP pattern registry ─────────────────────────
export type {
  SchemaRegistry,
  RegistrationOptions,
  SchemaRegistryEntry,
  SchemaSearchCriteria,
  SchemaListOptions,
  ERPPatternRegistry,
  ERPSchemaPattern,
  ERPEntityPattern,
  ERPFieldPattern,
  ERPPatternMatch,
  ERPEntityPatternMatch,
  ERPFieldMatch,
  SchemaRegistryEvent,
  SchemaRegistryObserver,
} from './registry/index';

// ─── 10. Fingerprint — structural fingerprint engine ─────────────────────
export type {
  FingerprintEngine,
  FingerprintOptions,
  SchemaFingerprint,
  EntityFingerprint,
  FieldFingerprint,
  FingerprintAlgorithm,
  FingerprintDelta,
  FingerprintStore,
  FingerprintAlgorithmRegistry,
} from './fingerprint/index';

// ─── 11. Similarity — structural similarity engine ───────────────────────
export type {
  SimilarityEngine,
  SimilarityOptions,
  SimilaritySearchOptions,
  FieldMappingOptions,
  SchemaSimilarityReport,
  EntityMatchResult,
  SchemaSimilarityRanking,
  EntitySimilarityScore,
  EntitySimilarityResult,
  FieldSimilarityScore,
  FieldMatchResult,
  FieldMappingResult,
  FieldMapping,
  SimilarityVerdict,
  SimilarityStrategyId,
  SimilarityStrategy,
  SimilarityWeights,
  SimilarityStrategyRegistry,
  NameSimilarityScorer,
} from './similarity/index';

export { DEFAULT_SIMILARITY_WEIGHTS } from './similarity/index';

// ─── 12. Learning — pattern learning layer ───────────────────────────────
export type {
  SchemaLearner,
  LearningSession,
  LearningResult,
  BatchLearningResult,
  LearnedPattern,
  LearnedPatternKind,
  LearnedPatternPayload,
  FieldNamingPattern,
  FieldRoleIndicatorPattern,
  EntityStructurePattern,
  CommonFieldDescriptor,
  RelationshipTopologyPattern,
  TypeEvolutionPattern,
  AuditFieldPattern,
  NamingAffix,
  PatternConflict,
  PatternSearchCriteria,
  PatternApplicator,
  SchemaEnrichmentResult,
  SchemaEnrichment,
  LearningStats,
} from './learning/index';

// ─── 13. Adapters — connector-to-SIE bridge ──────────────────────────────
export type {
  ConnectorSchemaAdapter,
  AdapterContext,
  DatabaseSchemaAdapter,
  DatabaseMetadataInput,
  SchemaMetadataInput,
  TableMetadataInput,
  ColumnMetadataInput,
  ForeignKeyMetadataInput,
  IndexMetadataInput,
  ApiSchemaAdapter,
  ApiMetadataInput,
  EndpointMetadataInput,
  ParameterMetadataInput,
  SchemaDefinitionInput,
  FileSchemaAdapter,
  FileMetadataInput,
  FileColumnInput,
  CloudSchemaAdapter,
  CloudMetadataInput,
  CloudObjectMetadataInput,
  ConnectorAdapterRegistry,
} from './adapters/index';

// ─── 14. Transformers — type mapping and naming conversion ────────────────
export type {
  TypeTransformer,
  TypeTransformContext,
  TypeMappingTable,
  TypeMapping,
  TypeTransformerRegistry,
  NamingConventionTransformer,
  FieldTransformer,
  FieldTransformContext,
  EntityTransformer,
  EntityTransformContext,
  TransformationPipeline,
  FieldRoleInferrer,
  FieldRoleInferrerResult,
  FieldRoleHeuristic,
  TypeCompatibilityMatrix,
} from './transformers/index';

// ─── 15. Validators — schema validation rules ────────────────────────────
export type {
  SchemaValidator,
  ValidationOptions,
  SchemaValidationResult,
  EntityValidationResult,
  FieldValidationResult,
  RelationshipValidationResult,
  ValidationIssue,
  ValidationSeverity,
  ValidationRule,
  ValidationRuleScope,
  BuiltInRuleId,
  FieldValidator,
  RelationshipValidator,
  ConstraintValidator,
  ValidationRuleRegistry,
} from './validators/index';

export { BUILT_IN_RULE_IDS } from './validators/index';
