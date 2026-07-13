import { describe, it, expect } from 'vitest';
import { adaptDatabaseSchema } from '../../services/discovery-adapter.js';
import type { DatabaseSchema } from '@seltriva/database-sdk';

const MINIMAL_SCHEMA: DatabaseSchema = {
  name: 'test_db',
  tables: [
    {
      name: 'produtos',
      columns: [
        {
          name: 'id',
          type: 'serial',
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          name: 'descricao',
          type: 'varchar',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
        {
          name: 'preco',
          type: 'numeric',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          precision: 10,
          scale: 2,
        },
        {
          name: 'ativo',
          type: 'boolean',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      primaryKey: { columns: ['id'] },
      foreignKeys: [],
      indexes: [
        {
          name: 'idx_produtos_descricao',
          columns: ['descricao'],
          isUnique: false,
          isPrimary: false,
        },
      ],
    },
    {
      name: 'clientes',
      columns: [
        {
          name: 'id',
          type: 'serial',
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
        },
        {
          name: 'razao_social',
          type: 'varchar',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
        {
          name: 'cnpj_cpf',
          type: 'varchar',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          maxLength: 18,
        },
      ],
      primaryKey: undefined,
      foreignKeys: [],
      indexes: [],
    },
    {
      name: 'estoque',
      columns: [
        {
          name: 'cod_produto',
          type: 'integer',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: true,
          isUnique: false,
        },
        {
          name: 'cod_deposito',
          type: 'varchar',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
        {
          name: 'qtd_atual',
          type: 'numeric',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
      primaryKey: undefined,
      foreignKeys: [{ column: 'cod_produto', referencedTable: 'produtos', referencedColumn: 'id' }],
      indexes: [],
    },
  ],
  relations: [],
  discoveredAt: new Date(),
};

describe('adaptDatabaseSchema', () => {
  it('returns a DatabaseInput with a single schema entry', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA);
    expect(result.schemas).toHaveLength(1);
    expect(result.schemas[0]!.name).toBe('public');
  });

  it('uses provided opts for host, port, database', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA, {
      host: 'erp.local',
      port: 5435,
      database: 'erp_seltriva',
    });
    expect(result.host).toBe('erp.local');
    expect(result.port).toBe(5435);
    expect(result.database).toBe('erp_seltriva');
  });

  it('defaults host to localhost and port to 5432', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
  });

  it('falls back to schema.name for database when not provided', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA);
    expect(result.database).toBe('test_db');
  });

  it('maps all tables', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA);
    const tables = result.schemas[0]!.tables;
    expect(tables).toHaveLength(3);
    expect(tables.map((t) => t.name)).toEqual(['produtos', 'clientes', 'estoque']);
  });

  it('sets schema on every TableInput', () => {
    const result = adaptDatabaseSchema(MINIMAL_SCHEMA, { schema: 'erp' });
    for (const t of result.schemas[0]!.tables) {
      expect(t.schema).toBe('erp');
    }
  });

  it('maps columns with correct field types', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[0]!;
    expect(table.columns).toHaveLength(4);
    const priceCol = table.columns.find((c) => c.name === 'preco')!;
    expect(priceCol.dataType).toBe('numeric');
    expect(priceCol.isNullable).toBe(true);
    expect(priceCol.numericPrecision).toBe(10);
    expect(priceCol.numericScale).toBe(2);
  });

  it('resolves primaryKey from explicit PrimaryKey object', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[0]!;
    expect(table.primaryKey).not.toBeNull();
    expect(table.primaryKey!.columns).toEqual(['id']);
  });

  it('resolves primaryKey from isPrimaryKey columns when PrimaryKey is undefined', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[1]!; // clientes
    expect(table.primaryKey).not.toBeNull();
    expect(table.primaryKey!.columns).toEqual(['id']);
  });

  it('maps foreign keys correctly', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[2]!; // estoque
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0]!.columns).toEqual(['cod_produto']);
    expect(table.foreignKeys[0]!.referencedTable).toBe('produtos');
  });

  it('maps indexes correctly', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[0]!;
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0]!.name).toBe('idx_produtos_descricao');
    expect(table.indexes[0]!.isUnique).toBe(false);
    expect(table.indexes[0]!.indexType).toBe('btree');
  });

  it('marks serial columns as isIdentity', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[0]!;
    const idCol = table.columns.find((c) => c.name === 'id')!;
    expect(idCol.isIdentity).toBe(true);
  });

  it('marks non-serial pk columns as NOT isIdentity', () => {
    const schema: DatabaseSchema = {
      name: 'db',
      tables: [
        {
          name: 't',
          columns: [
            {
              name: 'code',
              type: 'varchar',
              nullable: false,
              isPrimaryKey: true,
              isForeignKey: false,
              isUnique: true,
            },
          ],
          primaryKey: undefined,
          foreignKeys: [],
          indexes: [],
        },
      ],
      relations: [],
      discoveredAt: new Date(),
    };
    const table = adaptDatabaseSchema(schema).schemas[0]!.tables[0]!;
    expect(table.columns[0]!.isIdentity).toBe(false);
  });

  it('preserves maxLength on varchar columns', () => {
    const table = adaptDatabaseSchema(MINIMAL_SCHEMA).schemas[0]!.tables[1]!; // clientes
    const cnpj = table.columns.find((c) => c.name === 'cnpj_cpf')!;
    expect(cnpj.maxLength).toBe(18);
  });

  it('returns empty extensions array', () => {
    expect(adaptDatabaseSchema(MINIMAL_SCHEMA).extensions).toEqual([]);
  });
});
