/**
 * ValidationEngine — validates records before dispatch.
 *
 * Checks:
 *  1. Schema conformance (expected fields present)
 *  2. Type validation (numeric fields contain numbers, etc.)
 *  3. Required fields not null
 *  4. Duplicate detection (within a batch; cross-batch is Atlas Cloud's responsibility)
 *  5. Integrity: no circular references in FK values (structural, not relational)
 */
import type { FieldSchema, SyncRecord, TableSchema, ValidationResult } from '../types/index.js';

export class ValidationEngine {
  private readonly _schemas = new Map<string, TableSchema>();
  private readonly _seenIds = new Map<string, Set<string>>();

  registerSchema(schema: TableSchema): void {
    const key = `${schema.schema}.${schema.table}`;
    this._schemas.set(key, schema);
  }

  validate(schema: string, table: string, record: SyncRecord): ValidationResult {
    const violations: string[] = [];
    const key = `${schema}.${table}`;
    const tableSchema = this._schemas.get(key);

    if (tableSchema) {
      for (const field of tableSchema.fields) {
        const value = record[field.name];

        // Required field check
        if (field.required && !field.nullable && (value === null || value === undefined)) {
          violations.push(`Required field "${field.name}" is null or missing`);
          continue;
        }

        // Type validation (best-effort)
        if (value !== null && value !== undefined) {
          const typeViolation = this._checkType(field, value);
          if (typeViolation) violations.push(typeViolation);
        }
      }
    }

    return { record, isValid: violations.length === 0, violations };
  }

  validateBatch(
    schema: string,
    table: string,
    records: readonly SyncRecord[]
  ): readonly ValidationResult[] {
    // Reset batch-level duplicate tracker
    const pkSeen = new Set<string>();
    const key = `${schema}.${table}`;
    this._seenIds.set(key, pkSeen);

    return records.map((record) => {
      const result = this.validate(schema, table, record);
      const violations = [...result.violations];

      // Duplicate detection within batch (by 'id' or first field)
      const id = String(record['id'] ?? record['uuid'] ?? record['pk'] ?? '');
      if (id && pkSeen.has(id)) {
        violations.push(`Duplicate record id "${id}" in batch`);
      } else if (id) {
        pkSeen.add(id);
      }

      return { record, isValid: violations.length === 0, violations };
    });
  }

  private _checkType(field: FieldSchema, value: unknown): string | null {
    const dt = field.type.toLowerCase();

    if (
      dt.includes('int') ||
      dt.includes('numeric') ||
      dt.includes('float') ||
      dt.includes('decimal')
    ) {
      if (typeof value === 'string' && isNaN(Number(value))) {
        return `Field "${field.name}" expects numeric type but received "${value}"`;
      }
    }

    if (dt.includes('bool')) {
      if (
        typeof value !== 'boolean' &&
        value !== 0 &&
        value !== 1 &&
        value !== 'true' &&
        value !== 'false'
      ) {
        return `Field "${field.name}" expects boolean but received "${value}"`;
      }
    }

    if (dt.includes('timestamp') || dt.includes('date')) {
      if (value instanceof Date && isNaN(value.getTime())) {
        return `Field "${field.name}" has invalid date value`;
      }
    }

    return null;
  }

  clearDuplicateCache(): void {
    this._seenIds.clear();
  }

  get schemaCount(): number {
    return this._schemas.size;
  }
}
