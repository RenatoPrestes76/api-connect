/**
 * @seltriva/ai-core
 * ATHENA — Enterprise AI Core for Seltriva Connect
 *
 * Root barrel. All public contracts exported here.
 * Use sub-path imports for tree-shaking in production builds.
 */

// ─── Providers (foundation) ───────────────────────────────────────────────
export type {
  AIResult,
  AIError,
  AIErrorCode,
  TokenUsage,
  AIProviderId,
  AIModelId,
  AgentId,
  PromptId,
  SessionId,
  RecommendationId,
  DecisionId,
  MemoryEntryId,
  FeedbackId,
  AIConfidenceValue,
  AIConfidenceTier,
  AIProvider,
  ProviderCapabilities,
  ProviderModality,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  AIMessage,
  AIMessageContent,
  FinishReason,
  AITool,
  ToolCall,
  ToolChoice,
  EmbeddingOptions,
  EmbeddingVector,
  CostEstimate,
  AIProviderConfig,
  KnownProviderId,
  AIProviderRegistry,
  AIProviderFactory,
  AIProviderSelector,
  ProviderRequirements,
  AITaskType,
} from './providers/index';

export { PROVIDER_IDS, MODEL_IDS, confidenceTier } from './providers/index';

// ─── Prompt Registry ──────────────────────────────────────────────────────
export type {
  PromptRegistry,
  PromptTemplate,
  PromptVariables,
  PromptVariableValue,
  PromptVariable,
  PromptVariableType,
  RenderedPrompt,
  PromptModifier,
  PromptOutputFormat,
  PromptVersionInfo,
  PromptPerformanceMetrics,
  PromptFilter,
  PromptSummary,
  BuiltInPromptId,
  PromptLoader,
  PromptRenderer,
  PromptVariableValidation,
} from './prompt-registry/index';

export { PROMPT_IDS } from './prompt-registry/index';

// ─── Memory ───────────────────────────────────────────────────────────────
export type {
  AIMemory,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryKind,
  MemoryDomain,
  MemoryPayload,
  SchemaStructureMemory,
  SemanticMappingMemory,
  ERPPatternMemory,
  PerformanceBaselineMemory,
  SyncPatternMemory,
  ConflictResolutionMemory,
  ValidationRuleMemory,
  SecurityClassificationMemory,
  ReasoningOutcomeMemory,
  AgentFeedbackMemory,
  ChangePatternMemory,
  MemoryQuery,
  MemoryContext,
  MemorySearchResult,
  MemoryFilter,
  ConsolidationOptions,
  ConsolidationResult,
  MemoryExport,
  MemoryStats,
  MemoryStore,
  EmbeddingMemoryStore,
} from './memory/index';

// ─── Reasoning ────────────────────────────────────────────────────────────
export type {
  ReasoningEngine,
  ReasoningInput,
  ReasoningResult,
  ReasoningChain,
  ReasoningStep,
  ReasoningStepType,
  Evidence,
  EvidenceType,
  Hypothesis,
  HypothesisStatus,
  ReasoningStrategyId,
  ReasoningStrategy,
  ReasoningPromptPlan,
  ReasoningComparison,
  ReasoningStore,
  ReasoningEvaluator,
  ReasoningEvaluation,
} from './reasoning/index';

// ─── Explainability ───────────────────────────────────────────────────────
export type {
  ExplainabilityEngine,
  Explanation,
  ExplanationContext,
  ExplanationEvidence,
  ExplanationEvidenceType,
  ExplanationAlternative,
  ExplanationStaleness,
  ExplanationVerbosity,
  ExplanationAudience,
  ExplanationOutputFormat,
  ExplanationContrast,
  ExplanationStore,
  ExplanationFormatter,
  ExplainabilityValidator,
  ExplainabilityValidationResult,
} from './explainability/index';

// ─── Recommendations ──────────────────────────────────────────────────────
export type {
  AIRecommendation,
  RecommendationKind,
  RecommendationPriority,
  RecommendationStatus,
  RecommendationImpact,
  EntityClassificationPayload,
  FieldMappingPayload,
  ERPIdentificationPayload,
  SyncStrategyPayload,
  PerformanceOptimizationPayload,
  SecurityClassificationPayload,
  ChangeImpactPayload,
  ValidationRulePayload,
  RecommendationEngine,
  RecommendationInput,
  RecommendationFilter,
  RecommendationStore,
  RecommendationReport,
} from './recommendations/index';

// ─── Context Builder ──────────────────────────────────────────────────────
export type {
  AIContextBuilder,
  AIContext,
  AIContextSection,
  ContextBuildInput,
  SchemaContextInput,
  MappingContextInput,
  ERPContextInput,
  SyncContextInput,
  PriorMappingHint,
  FieldContextHint,
  SyncConflictHint,
  ContextEnricher,
  ContextSerializer,
  ContextCache,
} from './context-builder/index';

export { DEFAULT_TOKEN_BUDGETS } from './context-builder/index';

// ─── Agents ───────────────────────────────────────────────────────────────
export type {
  AIAgent,
  AgentCapabilities,
  AgentSession,
  AgentAnalysisResult,
  AgentAnalysisReport,
  AgentFinding,
  AgentSpecialization,
  SchemaAnalystAgent,
  MappingAnalystAgent,
  ERPSpecialistAgent,
  PerformanceAnalystAgent,
  SyncAnalystAgent,
  SecurityAnalystAgent,
  ChangeAnalystAgent,
  ValidationAnalystAgent,
  MappingConflictInput,
  SchemaChangeInput,
  AIAgentRegistry,
  AIAgentOrchestrator,
  AgentPipelineStep,
  AgentPipelineResult,
  BuiltInAgentId,
} from './agents/index';

export { AGENT_IDS } from './agents/index';

// ─── Decision Engine ──────────────────────────────────────────────────────
export type {
  DecisionEngine,
  DecisionRecord,
  DecisionOutcome,
  DecisionMethod,
  DecisionRule,
  DecisionRuleResult,
  DecisionRuleViolation,
  DecisionThresholds,
  DecisionReviewEntry,
  DecisionReview,
  DecisionApproval,
  DecisionRejection,
  DecisionModification,
  BulkDecisionResult,
  DecisionFilter,
  DecisionStats,
  DecisionStore,
  DecisionNotifier,
  DecisionReport,
} from './decision-engine/index';

export { DECISION_RULE_IDS, DEFAULT_DECISION_THRESHOLDS } from './decision-engine/index';

// ─── Feedback ─────────────────────────────────────────────────────────────
export type {
  FeedbackSystem,
  FeedbackRecord,
  FeedbackInput,
  FeedbackKind,
  FeedbackSignal,
  FeedbackCorrection,
  CorrectionType,
  ReasoningQualityRating,
  FeedbackQuery,
  FeedbackSearchResult,
  FeedbackAggregate,
  DateRange,
  FeedbackStore,
} from './feedback/index';

// ─── Learning ─────────────────────────────────────────────────────────────
export type {
  AILearningEngine,
  LearningOutcome,
  BatchLearningOutcome,
  AILearningPattern,
  AILearningPatternKind,
  AILearningPatternPayload,
  NamingConventionPattern,
  StructuralSignaturePattern,
  TypeHeuristicPattern,
  PrefixStrippingPattern,
  AbbreviationExpansionPattern,
  MultilingualSynonymPattern,
  ConfidenceCalibrationPattern,
  ConflictResolutionPattern,
  RejectionPattern,
  WeightAdjustment,
  WeightRecalibration,
  AILearningPatternQuery,
  AILearningStats,
  AILearningStore,
} from './learning/index';

// ─── Validation ───────────────────────────────────────────────────────────
export type {
  AIValidationEngine,
  AIRecommendationValidation,
  ExplanationValidation,
  AIValidationIssue,
  AIValidationIssueCode,
  AnomalyDetectionInput,
  AnomalyDetectionResult,
  DetectedAnomaly,
  AnomalyKind,
  RuleSuggestionInput,
  AIValidationRule,
  AIOutputValidator,
  IntegrationValidationEngine,
  IntegrationValidationInput,
  IntegrationValidationResult,
  TransformationValidationInput,
  TransformationValidationResult,
} from './validation/index';

// ─── Security ─────────────────────────────────────────────────────────────
export type {
  AISecurityEngine,
  SensitivityLevel,
  SensitivityClassification,
  DataCategory,
  RegulatoryFramework,
  DataRetentionPolicy,
  FieldClassificationInput,
  FieldSecurityInput,
  FieldClassificationResult,
  FieldSensitivityRecord,
  SecurityRiskInput,
  SecurityRiskAssessment,
  SecurityRiskLevel,
  SecurityRisk,
  SecurityRiskCategory,
  SecurityMitigation,
  ComplianceIssue,
  SecurityPolicy,
  SecurityPolicyValidation,
  SecurityPolicyViolation,
} from './security/index';

export { SENSITIVE_FIELD_KINDS } from './security/index';

// ─── Performance ──────────────────────────────────────────────────────────
export type {
  ATHENAPerformanceMonitor,
  AgentInvocationMetrics,
  MetricsFilter,
  MetricsReport,
  AgentMetricsSummary,
  ProviderMetricsSummary,
  CostReport,
  SLOStatus,
  SLOObjectiveStatus,
  PerformanceDegradation,
  IntegrationPerformanceAnalyst,
  SyncPerformanceInput,
  SyncPerformanceAnalysis,
  Bottleneck,
  PerformanceOptimization,
} from './performance/index';

export { DEFAULT_SLOS } from './performance/index';

// ─── ERP Recognition ──────────────────────────────────────────────────────
export type {
  ERPRecognitionEngine,
  ERPRecognitionInput,
  ERPRecognitionResult,
  ERPCandidate,
  ERPIdentifyingSignal,
  ERPSignalType,
  ERPModuleIdentificationInput,
  ERPModuleIdentificationResult,
  ERPModuleCandidate,
  ERPConventionAnalysisInput,
  ERPConventionAnalysis,
  ERPConvention,
  ERPFingerprint,
  ERPStructuralSignature,
  ERPModuleFingerprint,
  ERPFingerprintRegistry,
} from './erp-recognition/index';

export { ERP_MODULE_IDS } from './erp-recognition/index';

// ─── Schema Analysis ──────────────────────────────────────────────────────
export type {
  SchemaAnalysisEngine,
  SchemaAnalysisInput,
  SchemaAnalysisOptions,
  EntityInput,
  FieldInput,
  EntityAnalysisInput,
  FieldAnalysisInput,
  SchemaAnalysisReport,
  SchemaAnalysisStatistics,
  EntityAnalysisReport,
  EntityCandidateResult,
  FieldAnalysisReport,
  FieldCandidateResult,
  SchemaAnomalyReport,
  SchemaAnomaly,
  SchemaAnomalyKind,
  SchemaChangeAssessmentInput,
  SchemaChange,
  SchemaChangeReport,
  SchemaChangeImpact,
  SchemaAnalysisIssue,
} from './schema-analysis/index';

// ─── Mapping Analysis ─────────────────────────────────────────────────────
export type {
  MappingAnalysisEngine,
  MappingAnalysisInput,
  MappingFieldInput,
  MappingAnalysisOptions,
  ExistingMappingHint,
  MappingAnalysisReport,
  MappingAnalysisStatistics,
  FieldMappingAnalysis,
  MappingMatchType,
  SemanticCompatibility,
  MappingConflict,
  MappingConflictKind,
  MappingConflictResolutionInput,
  MappingConflictResolution,
  TransformationSuggestionInput,
  TransformationSuggestion,
  TransformationKind,
  TransformationExample,
  MappingValidationInput,
  MappingValidationResult,
  MappingIssue,
  MappingDriftInput,
  MappingDriftReport,
} from './mapping-analysis/index';

// ─── Sync Analysis ────────────────────────────────────────────────────────
export type {
  SyncAnalysisEngine,
  SyncStrategyInput,
  SyncStrategyRecommendation,
  SyncStrategyKind,
  ConflictResolutionStrategy,
  RetryPolicy,
  SyncConflictInput,
  SyncRecordMetadata,
  SyncFieldConflict,
  PriorResolutionHint,
  SyncConflictType,
  SyncConflictResolution,
  SyncDiagnosisInput,
  SyncSymptom,
  SyncObservation,
  SyncExecutionSummary,
  SyncDiagnosisResult,
  RootCause,
  SyncRiskInput,
  SyncRiskAssessment,
  SyncRisk,
  SyncRiskKind,
  SyncMitigation,
  SyncPatternAnalysisInput,
  SyncPatternAnalysisResult,
  SyncPattern,
} from './sync-analysis/index';
