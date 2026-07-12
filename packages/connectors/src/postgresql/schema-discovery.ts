/**
 * SchemaDiscovery — reads database structure from information_schema + pg_catalog.
 *
 * Queries covered:
 *   - Schemas          → information_schema.schemata
 *   - Tables           → information_schema.tables + pg_class (for comments + partitioning)
 *   - Columns          → information_schema.columns + col_description()
 *   - Primary Keys     → information_schema.table_constraints + key_column_usage
 *   - Foreign Keys     → information_schema.referential_constraints
 *   - Indexes          → pg_indexes + pg_index + pg_am
 *   - Views            → information_schema.views + pg_class (comments)
 *   - Materialized Views → pg_matviews
 *   - Sequences        → information_schema.sequences
 *   - Enums            → pg_type + pg_enum
 *   - Extensions       → pg_extension
 *   - Server Info      → pg_database + pg_settings
 *
 * All identifiers in WHERE clauses are passed as $1/$2 parameters (never interpolated).
 * Column names used in SELECT targets are safe (read from the catalog, never user input).
 */
import type { QueryRunner } from './query-runner.js';
import {
  asSchemaName,
  asTableName,
  asColumnName,
  asIndexName,
  asConstraintName,
  asSequenceName,
  asViewName,
  type SchemaName,
  type ColumnMetadata,
  type TableMetadata,
  type ViewMetadata,
  type MaterializedViewMetadata,
  type SequenceMetadata,
  type EnumMetadata,
  type ExtensionMetadata,
  type PrimaryKeyMetadata,
  type ForeignKeyMetadata,
  type IndexMetadata,
} from './types.js';

// ─── Raw Row Types (pg returns everything as string) ─────────────────────────

// Plain `type` aliases (not `interface`) so these structurally satisfy the
// `Record<string, unknown>` generic constraint on QueryRunner.query<T>() —
// TypeScript interfaces don't automatically satisfy index-signature constraints.
type RawSchema = {
  schema_name: string;
  schema_owner: string;
};

type RawTable = {
  table_name: string;
  comment: string | null;
  is_partitioned: boolean;
};

type RawColumn = {
  column_name: string;
  ordinal_position: string;
  column_default: string | null;
  is_nullable: string;
  data_type: string;
  udt_name: string;
  character_maximum_length: string | null;
  numeric_precision: string | null;
  numeric_scale: string | null;
  datetime_precision: string | null;
  is_identity: string;
  identity_generation: string | null;
  is_generated: string;
  generation_expression: string | null;
  comment: string | null;
};

type RawPK = {
  constraint_name: string;
  column_name: string;
};

type RawFK = {
  constraint_name: string;
  column_name: string;
  foreign_schema: string;
  foreign_table: string;
  foreign_column: string;
  update_rule: string;
  delete_rule: string;
};

type RawIndex = {
  index_name: string;
  definition: string;
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
  column_names: string;
};

type RawView = {
  view_name: string;
  definition: string;
  comment: string | null;
};

type RawMatView = {
  view_name: string;
  definition: string;
  has_data: boolean;
  comment: string | null;
};

type RawSequence = {
  sequence_name: string;
  data_type: string;
  start_value: string;
  increment: string;
  minimum_value: string;
  maximum_value: string;
  cycle_option: string;
};

type RawEnum = {
  enum_name: string;
  values: string[];
};

type RawExtension = {
  name: string;
  version: string;
};

type RawServerInfo = {
  server_version: string;
  encoding: string;
  collation: string;
  timezone: string;
};

// ─── SchemaDiscovery ──────────────────────────────────────────────────────────

export class SchemaDiscovery {
  constructor(private readonly _runner: QueryRunner) {}

  // ─── Server Info ────────────────────────────────────────────────────────

  async getServerInfo(): Promise<{
    serverVersion: string;
    encoding: string;
    collation: string;
    timezone: string;
  }> {
    const { rows } = await this._runner.query<RawServerInfo>(`
      SELECT
        current_setting('server_version')                    AS server_version,
        pg_encoding_to_char(d.encoding)                     AS encoding,
        d.datcollate                                         AS collation,
        current_setting('TimeZone')                          AS timezone
      FROM pg_database d
      WHERE d.datname = current_database()
    `);

    const row = rows[0];
    if (!row) throw new Error('Could not retrieve server info');

    return {
      serverVersion: row.server_version,
      encoding: row.encoding,
      collation: row.collation,
      timezone: row.timezone,
    };
  }

  // ─── Extensions ─────────────────────────────────────────────────────────

  async getExtensions(): Promise<ExtensionMetadata[]> {
    const { rows } = await this._runner.query<RawExtension>(`
      SELECT extname AS name, extversion AS version
      FROM pg_extension
      ORDER BY extname
    `);
    return rows.map((r) => ({ name: r.name, version: r.version }));
  }

  // ─── Schemas ────────────────────────────────────────────────────────────

  async getSchemas(): Promise<Array<{ name: SchemaName; owner: string }>> {
    const { rows } = await this._runner.query<RawSchema>(`
      SELECT schema_name, schema_owner
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND schema_name NOT LIKE 'pg_temp_%'
        AND schema_name NOT LIKE 'pg_toast_temp_%'
      ORDER BY schema_name
    `);
    return rows.map((r) => ({
      name: asSchemaName(r.schema_name),
      owner: r.schema_owner,
    }));
  }

  // ─── Tables ─────────────────────────────────────────────────────────────

  async getTables(schema: SchemaName): Promise<
    Array<{
      name: typeof asTableName extends (s: string) => infer R ? R : never;
      comment: string | null;
      isPartitioned: boolean;
    }>
  > {
    const { rows } = await this._runner.query<RawTable>(
      `
      SELECT
        t.table_name,
        obj_description(pgc.oid, 'pg_class')    AS comment,
        (pgp.partrelid IS NOT NULL)              AS is_partitioned
      FROM information_schema.tables t
      JOIN pg_class pgc
        ON pgc.relname = t.table_name
      JOIN pg_namespace pgn
        ON pgn.oid = pgc.relnamespace
       AND pgn.nspname = t.table_schema
      LEFT JOIN pg_partitioned_table pgp
        ON pgp.partrelid = pgc.oid
      WHERE t.table_schema = $1
        AND t.table_type   = 'BASE TABLE'
      ORDER BY t.table_name
    `,
      [schema]
    );

    return rows.map((r) => ({
      name: asTableName(r.table_name),
      comment: r.comment,
      isPartitioned: Boolean(r.is_partitioned),
    }));
  }

  // ─── Columns ────────────────────────────────────────────────────────────

  async getColumns(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>
  ): Promise<ColumnMetadata[]> {
    const { rows } = await this._runner.query<RawColumn>(
      `
      SELECT
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.datetime_precision,
        c.is_identity,
        c.identity_generation,
        c.is_generated,
        c.generation_expression,
        col_description(pgc.oid, c.ordinal_position::int)  AS comment
      FROM information_schema.columns c
      JOIN pg_class pgc
        ON pgc.relname = c.table_name
      JOIN pg_namespace pgn
        ON pgn.oid = pgc.relnamespace
       AND pgn.nspname = c.table_schema
      WHERE c.table_schema = $1
        AND c.table_name   = $2
      ORDER BY c.ordinal_position
    `,
      [schema, table]
    );

    return rows.map((r) => ({
      name: asColumnName(r.column_name),
      ordinalPosition: parseInt(r.ordinal_position, 10),
      dataType: r.data_type,
      userDefinedType: r.udt_name !== r.data_type ? r.udt_name : null,
      isNullable: r.is_nullable === 'YES',
      defaultValue: r.column_default,
      characterMaxLength:
        r.character_maximum_length !== null ? parseInt(r.character_maximum_length, 10) : null,
      numericPrecision: r.numeric_precision !== null ? parseInt(r.numeric_precision, 10) : null,
      numericScale: r.numeric_scale !== null ? parseInt(r.numeric_scale, 10) : null,
      datetimePrecision: r.datetime_precision !== null ? parseInt(r.datetime_precision, 10) : null,
      isIdentity: r.is_identity === 'YES',
      identityGeneration: r.identity_generation as ColumnMetadata['identityGeneration'],
      isGenerated: r.is_generated === 'ALWAYS',
      generationExpression: r.generation_expression,
      comment: r.comment,
    }));
  }

  // ─── Primary Key ────────────────────────────────────────────────────────

  async getPrimaryKey(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>
  ): Promise<PrimaryKeyMetadata | null> {
    const { rows } = await this._runner.query<RawPK>(
      `
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name  = kcu.constraint_name
       AND tc.table_schema     = kcu.table_schema
       AND tc.table_name       = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema    = $1
        AND tc.table_name      = $2
      ORDER BY kcu.ordinal_position
    `,
      [schema, table]
    );

    if (rows.length === 0) return null;

    return {
      constraintName: asConstraintName(rows[0]!.constraint_name),
      columns: rows.map((r) => asColumnName(r.column_name)),
    };
  }

  // ─── Foreign Keys ────────────────────────────────────────────────────────

  async getForeignKeys(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>
  ): Promise<ForeignKeyMetadata[]> {
    const { rows } = await this._runner.query<RawFK>(
      `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema  AS foreign_schema,
        ccu.table_name    AS foreign_table,
        ccu.column_name   AS foreign_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name  = kcu.constraint_name
       AND tc.table_schema     = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name  = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = $1
        AND tc.table_name      = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `,
      [schema, table]
    );

    // Group by constraint name
    const groups = new Map<string, ForeignKeyMetadata>();
    for (const r of rows) {
      const key = r.constraint_name;
      if (!groups.has(key)) {
        groups.set(key, {
          constraintName: asConstraintName(r.constraint_name),
          columns: [],
          referencedSchema: asSchemaName(r.foreign_schema),
          referencedTable: asTableName(r.foreign_table),
          referencedColumns: [],
          updateRule: r.update_rule,
          deleteRule: r.delete_rule,
        });
      }
      const fk = groups.get(key)!;
      (fk.columns as ReturnType<typeof asColumnName>[]).push(asColumnName(r.column_name));
      (fk.referencedColumns as ReturnType<typeof asColumnName>[]).push(
        asColumnName(r.foreign_column)
      );
    }

    return [...groups.values()];
  }

  // ─── Indexes ─────────────────────────────────────────────────────────────

  async getIndexes(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>
  ): Promise<IndexMetadata[]> {
    const { rows } = await this._runner.query<RawIndex>(
      `
      SELECT
        i.indexname                                               AS index_name,
        i.indexdef                                                AS definition,
        ix.indisunique                                            AS is_unique,
        ix.indisprimary                                           AS is_primary,
        am.amname                                                 AS index_type,
        array_to_string(
          ARRAY(
            SELECT pg_get_indexdef(ix.indexrelid, k.pos::int + 1, true)
            FROM generate_subscripts(ix.indkey, 1) AS k(pos)
            WHERE ix.indkey[k.pos] <> 0
            ORDER BY k.pos
          ), ', '
        )                                                         AS column_names
      FROM pg_indexes i
      JOIN pg_class tc
        ON tc.relname = i.tablename
      JOIN pg_namespace tn
        ON tn.oid = tc.relnamespace
       AND tn.nspname = i.schemaname
      JOIN pg_class ic
        ON ic.relname = i.indexname
       AND ic.relnamespace = tn.oid
      JOIN pg_index ix
        ON ix.indrelid    = tc.oid
       AND ix.indexrelid  = ic.oid
      JOIN pg_am am
        ON am.oid = ic.relam
      WHERE i.schemaname = $1
        AND i.tablename  = $2
      ORDER BY i.indexname
    `,
      [schema, table]
    );

    return rows.map((r) => ({
      name: asIndexName(r.index_name),
      isUnique: Boolean(r.is_unique),
      isPrimary: Boolean(r.is_primary),
      indexType: r.index_type,
      columns: r.column_names ? r.column_names.split(', ').filter(Boolean) : [],
      definition: r.definition,
    }));
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  async getViews(schema: SchemaName): Promise<ViewMetadata[]> {
    const { rows } = await this._runner.query<RawView>(
      `
      SELECT
        v.table_name                                    AS view_name,
        v.view_definition                               AS definition,
        obj_description(pgc.oid, 'pg_class')           AS comment
      FROM information_schema.views v
      JOIN pg_class pgc
        ON pgc.relname = v.table_name
      JOIN pg_namespace pgn
        ON pgn.oid = pgc.relnamespace
       AND pgn.nspname = v.table_schema
      WHERE v.table_schema = $1
      ORDER BY v.table_name
    `,
      [schema]
    );

    const views: ViewMetadata[] = [];
    for (const r of rows) {
      const name = asViewName(r.view_name);
      const columns = await this.getColumns(schema, asTableName(r.view_name)).catch(() => []);
      views.push({ schema, name, definition: r.definition ?? '', comment: r.comment, columns });
    }
    return views;
  }

  // ─── Materialized Views ───────────────────────────────────────────────────

  async getMaterializedViews(schema: SchemaName): Promise<MaterializedViewMetadata[]> {
    const { rows } = await this._runner.query<RawMatView>(
      `
      SELECT
        mv.matviewname                               AS view_name,
        mv.definition,
        mv.ispopulated                               AS has_data,
        obj_description(pgc.oid, 'pg_class')        AS comment
      FROM pg_matviews mv
      JOIN pg_class pgc
        ON pgc.relname = mv.matviewname
      JOIN pg_namespace pgn
        ON pgn.oid = pgc.relnamespace
       AND pgn.nspname = mv.schemaname
      WHERE mv.schemaname = $1
      ORDER BY mv.matviewname
    `,
      [schema]
    );

    const matViews: MaterializedViewMetadata[] = [];
    for (const r of rows) {
      const name = asViewName(r.view_name);
      const columns = await this.getColumns(schema, asTableName(r.view_name)).catch(() => []);
      matViews.push({
        schema,
        name,
        definition: r.definition ?? '',
        hasData: Boolean(r.has_data),
        comment: r.comment,
        columns,
      });
    }
    return matViews;
  }

  // ─── Sequences ───────────────────────────────────────────────────────────

  async getSequences(schema: SchemaName): Promise<SequenceMetadata[]> {
    const { rows } = await this._runner.query<RawSequence>(
      `
      SELECT
        sequence_name,
        data_type,
        start_value,
        increment,
        minimum_value,
        maximum_value,
        cycle_option
      FROM information_schema.sequences
      WHERE sequence_schema = $1
      ORDER BY sequence_name
    `,
      [schema]
    );

    return rows.map((r) => ({
      schema,
      name: asSequenceName(r.sequence_name),
      dataType: r.data_type,
      start: r.start_value,
      increment: r.increment,
      minimum: r.minimum_value,
      maximum: r.maximum_value,
      cycle: r.cycle_option === 'YES',
    }));
  }

  // ─── Enums ───────────────────────────────────────────────────────────────

  async getEnums(schema: SchemaName): Promise<EnumMetadata[]> {
    const { rows } = await this._runner.query<RawEnum>(
      `
      SELECT
        t.typname                                        AS enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type t
      JOIN pg_namespace n
        ON n.oid = t.typnamespace
      JOIN pg_enum e
        ON e.enumtypid = t.oid
      WHERE n.nspname = $1
      GROUP BY t.typname
      ORDER BY t.typname
    `,
      [schema]
    );

    return rows.map((r) => ({
      schema,
      name: r.enum_name,
      values: Array.isArray(r.values) ? r.values : [],
    }));
  }

  // ─── Full Table Discovery ────────────────────────────────────────────────

  async discoverTable(
    schema: SchemaName,
    tableName: ReturnType<typeof asTableName>,
    isPartitioned: boolean
  ): Promise<TableMetadata> {
    const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
      this.getColumns(schema, tableName),
      this.getPrimaryKey(schema, tableName),
      this.getForeignKeys(schema, tableName),
      this.getIndexes(schema, tableName),
    ]);

    return {
      schema,
      name: tableName,
      comment: null,
      columns,
      primaryKey,
      foreignKeys,
      indexes,
      isPartitioned,
    };
  }
}
