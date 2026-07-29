export type SqlDialect =
  | 'SQLSERVER'
  | 'POSTGRESQL'
  | 'MYSQL'
  | 'ORACLE'
  | 'FIREBIRD'
  | 'MARIADB'
  | 'SQLITE';

export const ALL_SQL_DIALECTS: readonly SqlDialect[] = [
  'SQLSERVER',
  'POSTGRESQL',
  'MYSQL',
  'ORACLE',
  'FIREBIRD',
  'MARIADB',
  'SQLITE',
];

export interface SqlParameter {
  readonly name: string;
  readonly value: unknown;
}

export interface GeneratedQueryRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly queryPlanId: string;
  readonly canonicalModelId: string;
  readonly canonicalVersion: string;
  readonly profileId: string;
  readonly dialect: SqlDialect;
  readonly sql: string;
  readonly parameters: readonly SqlParameter[];
  readonly estimatedCost: number;
  readonly optimizations: readonly string[];
  readonly generatedAt: string;
  readonly createdBy: string;
}

export interface GenerateSqlInput {
  organizationId?: string;
  queryPlanId?: string;
  /** Disambiguates which ERP's physical table to target when multiple connected ERPs contributed the same canonical entity. */
  entityInstanceId?: string;
  /** Overrides dialect auto-detection from the resolved ERP connection profile — the only way to reach SQLITE, since no ERP connection type is SQLite. */
  dialect?: SqlDialect;
}

export type SqlGenerationErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_ORGANIZATION_MISMATCH'
  | 'CANONICAL_MODEL_NOT_FOUND'
  | 'ENTITY_INSTANCE_NOT_FOUND'
  | 'AMBIGUOUS_ENTITY_INSTANCE'
  | 'JOIN_SPANS_MULTIPLE_ERPS'
  | 'NO_PHYSICAL_RELATIONSHIP_FOUND'
  | 'FIELD_HAS_NO_PHYSICAL_COLUMN'
  | 'UNSUPPORTED_DIALECT'
  | 'UNKNOWN_DIALECT';

export interface SqlGenerationError {
  readonly code: SqlGenerationErrorCode;
  readonly message: string;
}

export type GenerateSqlResult =
  | { ok: true; record: GeneratedQueryRecord }
  | { ok: false; errors: SqlGenerationError[] };

export interface LogicalPlanEntity {
  readonly alias: string | null;
  readonly canonicalEntity: string;
  readonly physicalSchema: string;
  readonly physicalTable: string;
  readonly joinCondition?: string;
}

export interface ExplainResult {
  readonly sql: string;
  readonly parameters: readonly SqlParameter[];
  readonly dialect: SqlDialect;
  readonly estimatedCost: number;
  readonly logicalPlan: {
    readonly entities: readonly LogicalPlanEntity[];
    readonly filterCount: number;
    readonly projectionCount: number;
    readonly optimizations: readonly string[];
  };
}
