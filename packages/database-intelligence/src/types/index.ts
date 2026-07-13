/**
 * ATHENA DB AI — core domain types
 *
 * All types in this module are immutable value objects.
 * Confidence scores are integers in [0, 100].
 */

// ─── Entity Types ─────────────────────────────────────────────────────────────

/** Business entity types that ATHENA can identify in a database schema. */
export type EntityType =
  | 'PRODUCT'
  | 'SUPPLIER'
  | 'CATEGORY'
  | 'PRICE'
  | 'INVENTORY'
  | 'MOVEMENT'
  | 'SALE'
  | 'PURCHASE'
  | 'CUSTOMER'
  | 'USER'
  | 'BRANCH'
  | 'EXPIRY'
  | 'LOT'
  | 'PROMOTION'
  | 'FISCAL'
  | 'LOG'
  | 'AUDIT'
  | 'PERMISSION'
  | 'CONFIGURATION'
  | 'LOOKUP'
  | 'UNKNOWN';

export const ALL_ENTITY_TYPES: readonly EntityType[] = [
  'PRODUCT',
  'SUPPLIER',
  'CATEGORY',
  'PRICE',
  'INVENTORY',
  'MOVEMENT',
  'SALE',
  'PURCHASE',
  'CUSTOMER',
  'USER',
  'BRANCH',
  'EXPIRY',
  'LOT',
  'PROMOTION',
  'FISCAL',
  'LOG',
  'AUDIT',
  'PERMISSION',
  'CONFIGURATION',
  'LOOKUP',
  'UNKNOWN',
];

/** Roles that individual columns can play within a table. */
export type FieldRole =
  | 'IDENTIFIER'
  | 'CODE'
  | 'SKU'
  | 'EAN'
  | 'NAME'
  | 'DESCRIPTION'
  | 'PRICE'
  | 'COST_PRICE'
  | 'SALE_PRICE'
  | 'MARGIN'
  | 'QUANTITY'
  | 'BALANCE'
  | 'WEIGHT'
  | 'EXPIRY_DATE'
  | 'MANUFACTURE_DATE'
  | 'STATUS'
  | 'FLAG'
  | 'BRAND'
  | 'TIMESTAMP_CREATED'
  | 'TIMESTAMP_UPDATED'
  | 'SOFT_DELETE'
  | 'FOREIGN_KEY'
  | 'CATEGORY_FK'
  | 'SUPPLIER_FK'
  | 'BRANCH_FK'
  | 'CUSTOMER_FK'
  | 'PRODUCT_FK'
  | 'UNKNOWN';

// ─── Confidence & Scoring ─────────────────────────────────────────────────────

/** Integer in [0, 100]. Higher = more confident. */
export type ConfidenceScore = number;

/** A single piece of evidence that contributes to a confidence score. */
export interface ScoringReason {
  readonly signal: string;
  readonly weight: number;
  readonly detail: string;
}

/** Raw scores from a single scorer, keyed by EntityType. */
export type ScoreMap = Partial<Record<EntityType, number>>;

// ─── Field Classification ─────────────────────────────────────────────────────

export interface FieldRoleAssignment {
  readonly columnName: string;
  readonly role: FieldRole;
  readonly confidence: ConfidenceScore;
  readonly reasons: readonly ScoringReason[];
}

/** column name → role assignment */
export type FieldRoleMap = ReadonlyMap<string, FieldRoleAssignment>;

// ─── Entity Classification ────────────────────────────────────────────────────

export interface AlternativeEntity {
  readonly entity: EntityType;
  readonly confidence: ConfidenceScore;
}

/** Full classification result for a single database table. */
export interface EntityClassification {
  readonly tableSchema: string;
  readonly tableName: string;
  readonly entity: EntityType;
  readonly confidence: ConfidenceScore;
  readonly reasons: readonly ScoringReason[];
  readonly alternatives: readonly AlternativeEntity[];
  readonly fieldRoles: FieldRoleMap;
  readonly isAuxiliary: boolean;
  readonly isJunctionTable: boolean;
  readonly estimatedRows: number | null;
}

// ─── Relationships ────────────────────────────────────────────────────────────

export type RelationshipKind =
  | 'ONE_TO_ONE'
  | 'ONE_TO_MANY'
  | 'MANY_TO_MANY'
  | 'RECURSIVE'
  | 'HIERARCHICAL'
  | 'CIRCULAR';

export type CardinalityLabel = '1:1' | '1:N' | 'N:1' | 'N:N';

export interface DiscoveredRelationship {
  readonly fromSchema: string;
  readonly fromTable: string;
  readonly fromColumn: string;
  readonly toSchema: string;
  readonly toTable: string;
  readonly toColumn: string;
  readonly kind: RelationshipKind;
  readonly cardinality: CardinalityLabel;
  readonly constraintName: string;
  readonly confidence: ConfidenceScore;
  readonly reasons: readonly ScoringReason[];
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export interface KnowledgeNode {
  readonly id: string; // "{schema}.{table}"
  readonly entity: EntityType;
  readonly confidence: ConfidenceScore;
  readonly classification: EntityClassification;
}

export interface KnowledgeEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly kind: RelationshipKind;
  readonly cardinality: CardinalityLabel;
  readonly label: string;
  readonly confidence: ConfidenceScore;
}

export interface KnowledgeGraphSnapshot {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
}

// ─── Risk & Suggestions ───────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskItem {
  readonly level: RiskLevel;
  readonly category: string;
  readonly description: string;
  readonly tables: readonly string[];
  readonly suggestion: string;
}

export interface IntegrationSuggestion {
  readonly priority: 1 | 2 | 3;
  readonly entity: EntityType;
  readonly table: string;
  readonly reason: string;
  readonly fieldMapping: ReadonlyMap<string, FieldRole>;
}

// ─── UI / Dashboard DTOs ─────────────────────────────────────────────────────

export interface UIEntityNode {
  readonly id: string;
  readonly label: string;
  readonly entity: EntityType;
  readonly confidence: ConfidenceScore;
  readonly schema: string;
  readonly table: string;
  readonly columns: number;
  readonly rows: number | null;
}

export interface UIRelationshipEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: RelationshipKind;
  readonly cardinality: CardinalityLabel;
  readonly label: string;
}

export interface UIHeatmapCell {
  readonly schema: string;
  readonly table: string;
  readonly entity: EntityType;
  readonly confidence: ConfidenceScore;
  readonly estimatedRows: number | null;
}

// ─── Intelligence Report ──────────────────────────────────────────────────────

export interface ReportSummary {
  readonly schemasFound: number;
  readonly tablesFound: number;
  readonly columnsFound: number;
  readonly entitiesIdentified: number;
  readonly relationshipsFound: number;
  readonly auxiliaryTables: number;
  readonly junctionTables: number;
  readonly overallConfidence: ConfidenceScore;
  readonly hasRisks: boolean;
}

export interface DatabaseIntelligenceReport {
  readonly generatedAt: string;
  readonly durationMs: number;
  readonly database: string;
  readonly host: string;
  readonly port: number;
  readonly summary: ReportSummary;
  readonly entities: Readonly<Partial<Record<EntityType, readonly EntityClassification[]>>>;
  readonly relationships: readonly DiscoveredRelationship[];
  readonly knowledgeGraph: KnowledgeGraphSnapshot;
  readonly risks: readonly RiskItem[];
  readonly suggestions: readonly IntegrationSuggestion[];
  readonly ui: {
    readonly entityMap: readonly UIEntityNode[];
    readonly relationshipMap: readonly UIRelationshipEdge[];
    readonly heatmap: readonly UIHeatmapCell[];
  };
}

// ─── Scanner Options ──────────────────────────────────────────────────────────

export interface ScanOptions {
  readonly includeSchemas?: readonly string[];
  readonly excludeSchemas?: readonly string[];
  readonly includeTables?: readonly string[];
  readonly excludeTables?: readonly string[];
  readonly enableProfiling?: boolean;
  readonly sampleSize?: number;
  readonly parallelism?: number;
  readonly cacheTtlMs?: number;
}

export const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  includeSchemas: [],
  excludeSchemas: [],
  includeTables: [],
  excludeTables: [],
  enableProfiling: true,
  sampleSize: 100,
  parallelism: 4,
  cacheTtlMs: 30 * 60 * 1000, // 30 minutes
};

// ─── Introspection Input ──────────────────────────────────────────────────────

// Minimal view of the PostgreSQL introspection report used as input.
// This avoids a hard dependency on the PostgreSQL connector's internal types.

export interface TableInput {
  readonly schema: string;
  readonly name: string;
  readonly comment: string | null;
  readonly isPartitioned: boolean;
  readonly columns: readonly ColumnInput[];
  readonly primaryKey: PrimaryKeyInput | null;
  readonly foreignKeys: readonly ForeignKeyInput[];
  readonly indexes: readonly IndexInput[];
  readonly statistics?: TableStatsInput;
}

export interface ColumnInput {
  readonly name: string;
  readonly dataType: string;
  readonly isNullable: boolean;
  readonly columnDefault: string | null;
  readonly numericPrecision: number | null;
  readonly numericScale: number | null;
  readonly maxLength: number | null;
  readonly userDefinedType: string | null;
  readonly comment: string | null;
  readonly isIdentity: boolean;
}

export interface PrimaryKeyInput {
  readonly constraintName: string;
  readonly columns: readonly string[];
}

export interface ForeignKeyInput {
  readonly constraintName: string;
  readonly columns: readonly string[];
  readonly referencedSchema: string;
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
  readonly deleteRule: string;
  readonly updateRule: string;
}

export interface IndexInput {
  readonly name: string;
  readonly columns: readonly string[];
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly indexType: string;
}

export interface TableStatsInput {
  readonly estimatedRows: number | null;
  readonly tableSizeBytes: number | null;
}

export interface SchemaInput {
  readonly name: string;
  readonly tables: readonly TableInput[];
}

export interface DatabaseInput {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly schemas: readonly SchemaInput[];
  readonly extensions: readonly string[];
}
