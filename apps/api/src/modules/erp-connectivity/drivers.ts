import type { DbType } from './types.js';

/**
 * Static metadata per database type — no live driver code lives here (this
 * package has no DB driver dependencies; only the Atlas Runtime dials the
 * actual ERP database). Keyed by DbType so a new entry never touches an
 * existing one — "permitir adicionar novos drivers sem alterar os existentes".
 */
export interface DriverMetadata {
  dbType: DbType;
  displayName: string;
  defaultPort: number;
  simulatedVersion: string;
}

export const DRIVER_REGISTRY: Record<DbType, DriverMetadata> = {
  POSTGRESQL: {
    dbType: 'POSTGRESQL',
    displayName: 'PostgreSQL',
    defaultPort: 5432,
    simulatedVersion: 'PostgreSQL 16',
  },
  SQLSERVER: {
    dbType: 'SQLSERVER',
    displayName: 'Microsoft SQL Server',
    defaultPort: 1433,
    simulatedVersion: 'SQL Server 2022',
  },
  MYSQL: {
    dbType: 'MYSQL',
    displayName: 'MySQL',
    defaultPort: 3306,
    simulatedVersion: 'MySQL 8.0',
  },
  MARIADB: {
    dbType: 'MARIADB',
    displayName: 'MariaDB',
    defaultPort: 3306,
    simulatedVersion: 'MariaDB 11',
  },
  ORACLE: {
    dbType: 'ORACLE',
    displayName: 'Oracle Database',
    defaultPort: 1521,
    simulatedVersion: 'Oracle 19c',
  },
  FIREBIRD: {
    dbType: 'FIREBIRD',
    displayName: 'Firebird',
    defaultPort: 3050,
    simulatedVersion: 'Firebird 4.0',
  },
};

export function listSupportedDrivers(): DriverMetadata[] {
  return Object.values(DRIVER_REGISTRY);
}

export function isSupportedDbType(value: string): value is DbType {
  return value in DRIVER_REGISTRY;
}
