import type { SqlDialect } from '../types.js';
import type { DialectGenerator } from './dialect-generator.js';
import { sqlServerGenerator } from './sqlserver.generator.js';
import { postgresGenerator } from './postgres.generator.js';
import { mysqlGenerator } from './mysql.generator.js';
import { oracleGenerator } from './oracle.generator.js';
import { firebirdGenerator } from './firebird.generator.js';
import { mariadbGenerator } from './mariadb.generator.js';
import { sqliteGenerator } from './sqlite.generator.js';

const REGISTRY: Readonly<Record<SqlDialect, DialectGenerator>> = {
  SQLSERVER: sqlServerGenerator,
  POSTGRESQL: postgresGenerator,
  MYSQL: mysqlGenerator,
  ORACLE: oracleGenerator,
  FIREBIRD: firebirdGenerator,
  MARIADB: mariadbGenerator,
  SQLITE: sqliteGenerator,
};

export function getDialectGenerator(dialect: SqlDialect): DialectGenerator {
  return REGISTRY[dialect];
}

export type { DialectGenerator };
