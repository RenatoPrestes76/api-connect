import { createHash } from 'node:crypto';
import type { DatabaseSchema } from '@seltriva/database-sdk';

/**
 * Deterministic fingerprint of a Runtime-reported schema — sorted so column
 * reordering in the source ERP never produces a spurious "changed" result.
 * Used to skip re-running the (comparatively expensive, worker-pool-backed)
 * ATHENA classifier when a re-scan reports back an unchanged structure —
 * the actual "incremental reads" mechanism for GET /erp-metadata/*.
 */
export function computeSchemaChecksum(schema: DatabaseSchema): string {
  const canonicalTables = [...schema.tables]
    .map((t) => ({
      name: t.name,
      columns: [...t.columns]
        .map((c) => `${c.name}:${c.type}:${c.nullable}:${c.isPrimaryKey}`)
        .sort(),
      foreignKeys: [...t.foreignKeys]
        .map((fk) => `${fk.column}->${fk.referencedTable}.${fk.referencedColumn}`)
        .sort(),
      indexes: [...t.indexes].map((i) => `${i.name}:${i.columns.join(',')}:${i.isUnique}`).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return createHash('sha256').update(JSON.stringify(canonicalTables)).digest('hex');
}
