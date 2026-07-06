import type { Query } from '../query/query-types.js';
import type { DatabaseSchema } from '../schema/schema-reader.js';
import type { DatabaseHealth, HealthStatus } from '../health/database-health.js';

export type { DatabaseHealth, HealthStatus };

export interface DatabaseAdapter {
  connect():    Promise<void>;
  disconnect(): Promise<void>;
  reconnect():  Promise<void>;
  execute<T = unknown>(query: Query): Promise<T[]>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  health():     Promise<DatabaseHealth>;
  schema():     Promise<DatabaseSchema>;
}
