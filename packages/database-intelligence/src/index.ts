/**
 * @seltriva/database-intelligence — public API
 *
 * ATHENA DB AI — classifies database tables into business entities,
 * builds a knowledge graph, detects risks, and generates integration suggestions.
 */

// ─── Top-level orchestrator ───────────────────────────────────────────────────
export { DatabaseScanner } from './engine/database-scanner.js';

// ─── Classifier ───────────────────────────────────────────────────────────────
export { EntityClassifier } from './classifier/entity-classifier.js';

// ─── Knowledge Graph ──────────────────────────────────────────────────────────
export { KnowledgeGraph } from './knowledge-graph/graph.js';
export { GraphBuilder }   from './knowledge-graph/graph-builder.js';

// ─── Types (value objects + domain vocabulary) ────────────────────────────────
export type {
  EntityType,
  FieldRole,
  ConfidenceScore,
  ScoringReason,
  ScoreMap,
  FieldRoleAssignment,
  FieldRoleMap,
  AlternativeEntity,
  EntityClassification,
  RelationshipKind,
  CardinalityLabel,
  DiscoveredRelationship,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphSnapshot,
  RiskLevel,
  RiskItem,
  IntegrationSuggestion,
  UIEntityNode,
  UIRelationshipEdge,
  UIHeatmapCell,
  ReportSummary,
  DatabaseIntelligenceReport,
  ScanOptions,
  TableInput,
  ColumnInput,
  PrimaryKeyInput,
  ForeignKeyInput,
  IndexInput,
  TableStatsInput,
  SchemaInput,
  DatabaseInput,
} from './types/index.js';

export { ALL_ENTITY_TYPES, DEFAULT_SCAN_OPTIONS } from './types/index.js';
