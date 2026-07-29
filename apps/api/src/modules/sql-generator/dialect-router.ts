import type { DbType } from '../erp-connectivity/types.js';
import type { SqlDialect } from './types.js';

/** DbType (erp-connectivity, 46.8) -> SqlDialect. SQLITE has no corresponding DbType — it's only reachable via an explicit dialect override, never auto-detected from a real ERP connection. */
const DB_TYPE_TO_DIALECT: Readonly<Record<DbType, SqlDialect>> = {
  POSTGRESQL: 'POSTGRESQL',
  SQLSERVER: 'SQLSERVER',
  MYSQL: 'MYSQL',
  MARIADB: 'MARIADB',
  ORACLE: 'ORACLE',
  FIREBIRD: 'FIREBIRD',
};

export function routeDialect(dbType: DbType): SqlDialect {
  return DB_TYPE_TO_DIALECT[dbType];
}
