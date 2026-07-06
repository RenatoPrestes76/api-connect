/**
 * SchemaDiscovery — unit tests (mocked QueryRunner)
 *
 * Tests: getSchemas, getTables, getColumns (types, nullable, comments),
 * getPrimaryKey, getForeignKeys, getIndexes, getEnums, getExtensions.
 */
import { describe, it, expect, vi } from 'vitest';
import { SchemaDiscovery } from '../schema-discovery.js';
import { asSchemaName, asTableName } from '../types.js';
import type { QueryRunner } from '../query-runner.js';

// ─── QueryRunner Mock ─────────────────────────────────────────────────────────

function makeRunner(rows: Record<string, unknown>[]): QueryRunner {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
    recentMetrics: [],
  } as unknown as QueryRunner;
}

const PUBLIC = asSchemaName('public');
const PEDIDO = asTableName('pedido');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchemaDiscovery', () => {
  describe('getServerInfo()', () => {
    it('returns server version, encoding, collation, timezone', async () => {
      const runner = makeRunner([{
        server_version: '15.3',
        encoding: 'UTF8',
        collation: 'en_US.UTF-8',
        timezone: 'UTC',
      }]);
      const discovery = new SchemaDiscovery(runner);
      const info = await discovery.getServerInfo();

      expect(info.serverVersion).toBe('15.3');
      expect(info.encoding).toBe('UTF8');
      expect(info.timezone).toBe('UTC');
    });

    it('throws if no rows returned', async () => {
      const runner = makeRunner([]);
      const discovery = new SchemaDiscovery(runner);
      await expect(discovery.getServerInfo()).rejects.toThrow();
    });
  });

  describe('getExtensions()', () => {
    it('maps rows to ExtensionMetadata', async () => {
      const runner = makeRunner([
        { name: 'uuid-ossp', version: '1.1' },
        { name: 'pg_stat_statements', version: '1.10' },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const exts = await discovery.getExtensions();

      expect(exts).toHaveLength(2);
      expect(exts[0]).toEqual({ name: 'uuid-ossp', version: '1.1' });
    });
  });

  describe('getSchemas()', () => {
    it('returns branded SchemaName list', async () => {
      const runner = makeRunner([
        { schema_name: 'public', schema_owner: 'postgres' },
        { schema_name: 'vendas', schema_owner: 'app_user' },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const schemas = await discovery.getSchemas();

      expect(schemas).toHaveLength(2);
      expect(String(schemas[0]!.name)).toBe('public');
      expect(schemas[1]!.owner).toBe('app_user');
    });
  });

  describe('getTables()', () => {
    it('returns tables with comment and partitioned flag', async () => {
      const runner = makeRunner([
        { table_name: 'pedido', comment: 'Pedidos de venda', is_partitioned: false },
        { table_name: 'produto', comment: null, is_partitioned: true },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const tables = await discovery.getTables(PUBLIC);

      expect(tables).toHaveLength(2);
      expect(String(tables[0]!.name)).toBe('pedido');
      expect(tables[0]!.comment).toBe('Pedidos de venda');
      expect(tables[1]!.isPartitioned).toBe(true);
    });
  });

  describe('getColumns()', () => {
    it('maps all column fields correctly', async () => {
      const runner = makeRunner([{
        column_name:           'preco_venda',
        ordinal_position:      '3',
        column_default:        null,
        is_nullable:           'NO',
        data_type:             'numeric',
        udt_name:              'numeric',
        character_maximum_length: null,
        numeric_precision:     '12',
        numeric_scale:         '2',
        datetime_precision:    null,
        is_identity:           'NO',
        identity_generation:   null,
        is_generated:          'NEVER',
        generation_expression: null,
        comment:               'Preço de venda com IPI',
      }]);
      const discovery = new SchemaDiscovery(runner);
      const cols = await discovery.getColumns(PUBLIC, PEDIDO);

      expect(cols).toHaveLength(1);
      const col = cols[0]!;
      expect(String(col.name)).toBe('preco_venda');
      expect(col.dataType).toBe('numeric');
      expect(col.numericPrecision).toBe(12);
      expect(col.numericScale).toBe(2);
      expect(col.isNullable).toBe(false);
      expect(col.comment).toBe('Preço de venda com IPI');
    });

    it('marks column as nullable when is_nullable=YES', async () => {
      const runner = makeRunner([{
        column_name: 'deleted_at', ordinal_position: '5',
        column_default: null, is_nullable: 'YES',
        data_type: 'timestamp with time zone', udt_name: 'timestamptz',
        character_maximum_length: null, numeric_precision: null,
        numeric_scale: null, datetime_precision: '6',
        is_identity: 'NO', identity_generation: null,
        is_generated: 'NEVER', generation_expression: null, comment: null,
      }]);
      const discovery = new SchemaDiscovery(runner);
      const [col] = await discovery.getColumns(PUBLIC, PEDIDO);
      expect(col!.isNullable).toBe(true);
    });

    it('sets userDefinedType when udt_name differs from data_type', async () => {
      const runner = makeRunner([{
        column_name: 'status', ordinal_position: '2',
        column_default: "'pendente'", is_nullable: 'NO',
        data_type: 'USER-DEFINED', udt_name: 'status_pedido',
        character_maximum_length: null, numeric_precision: null,
        numeric_scale: null, datetime_precision: null,
        is_identity: 'NO', identity_generation: null,
        is_generated: 'NEVER', generation_expression: null, comment: null,
      }]);
      const discovery = new SchemaDiscovery(runner);
      const [col] = await discovery.getColumns(PUBLIC, PEDIDO);
      expect(col!.userDefinedType).toBe('status_pedido');
    });
  });

  describe('getPrimaryKey()', () => {
    it('returns PrimaryKeyMetadata with columns', async () => {
      const runner = makeRunner([
        { constraint_name: 'pedido_pkey', column_name: 'id' },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const pk = await discovery.getPrimaryKey(PUBLIC, PEDIDO);

      expect(pk).not.toBeNull();
      expect(String(pk!.constraintName)).toBe('pedido_pkey');
      expect(pk!.columns.map(String)).toEqual(['id']);
    });

    it('returns null when no primary key exists', async () => {
      const runner = makeRunner([]);
      const discovery = new SchemaDiscovery(runner);
      const pk = await discovery.getPrimaryKey(PUBLIC, PEDIDO);
      expect(pk).toBeNull();
    });

    it('supports composite primary keys', async () => {
      const runner = makeRunner([
        { constraint_name: 'estoque_pkey', column_name: 'filial_id' },
        { constraint_name: 'estoque_pkey', column_name: 'produto_id' },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const pk = await discovery.getPrimaryKey(PUBLIC, asTableName('estoque_filial'));
      expect(pk!.columns).toHaveLength(2);
    });
  });

  describe('getForeignKeys()', () => {
    it('groups FK columns by constraint name', async () => {
      const runner = makeRunner([
        {
          constraint_name: 'pedido_cliente_fk',
          column_name:     'cliente_id',
          foreign_schema:  'public',
          foreign_table:   'cliente',
          foreign_column:  'id',
          update_rule:     'NO ACTION',
          delete_rule:     'RESTRICT',
        },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const fks = await discovery.getForeignKeys(PUBLIC, PEDIDO);

      expect(fks).toHaveLength(1);
      const fk = fks[0]!;
      expect(String(fk.constraintName)).toBe('pedido_cliente_fk');
      expect(String(fk.referencedTable)).toBe('cliente');
      expect(fk.deleteRule).toBe('RESTRICT');
    });

    it('returns empty array when no FKs exist', async () => {
      const discovery = new SchemaDiscovery(makeRunner([]));
      const fks = await discovery.getForeignKeys(PUBLIC, PEDIDO);
      expect(fks).toHaveLength(0);
    });
  });

  describe('getIndexes()', () => {
    it('maps index metadata correctly', async () => {
      const runner = makeRunner([
        {
          index_name:   'idx_pedido_cliente',
          definition:   'CREATE INDEX idx_pedido_cliente ON public.pedido USING btree (cliente_id)',
          is_unique:    false,
          is_primary:   false,
          index_type:   'btree',
          column_names: 'cliente_id',
        },
        {
          index_name:   'pedido_pkey',
          definition:   'CREATE UNIQUE INDEX pedido_pkey ON public.pedido USING btree (id)',
          is_unique:    true,
          is_primary:   true,
          index_type:   'btree',
          column_names: 'id',
        },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const indexes = await discovery.getIndexes(PUBLIC, PEDIDO);

      expect(indexes).toHaveLength(2);
      expect(String(indexes[0]!.name)).toBe('idx_pedido_cliente');
      expect(indexes[0]!.isUnique).toBe(false);
      expect(indexes[1]!.isPrimary).toBe(true);
    });
  });

  describe('getEnums()', () => {
    it('returns enum values as array', async () => {
      const runner = makeRunner([
        { enum_name: 'status_pedido', values: ['pendente', 'aprovado', 'cancelado'] },
      ]);
      const discovery = new SchemaDiscovery(runner);
      const enums = await discovery.getEnums(PUBLIC);

      expect(enums).toHaveLength(1);
      expect(enums[0]!.name).toBe('status_pedido');
      expect(enums[0]!.values).toEqual(['pendente', 'aprovado', 'cancelado']);
    });
  });

  describe('getSequences()', () => {
    it('maps sequence metadata', async () => {
      const runner = makeRunner([{
        sequence_name: 'produto_seq',
        data_type:     'bigint',
        start_value:   '1000',
        increment:     '1',
        minimum_value: '1',
        maximum_value: '9223372036854775807',
        cycle_option:  'NO',
      }]);
      const discovery = new SchemaDiscovery(runner);
      const seqs = await discovery.getSequences(PUBLIC);

      expect(seqs).toHaveLength(1);
      expect(String(seqs[0]!.name)).toBe('produto_seq');
      expect(seqs[0]!.start).toBe('1000');
      expect(seqs[0]!.cycle).toBe(false);
    });
  });
});
