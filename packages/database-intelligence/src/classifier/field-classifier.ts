/**
 * FieldClassifier — assigns FieldRoles to individual columns.
 *
 * Uses FIELD_PATTERNS name matching + DATA_TYPE_ROLE_HINTS + sample value detection.
 */
import { FIELD_PATTERNS, DATA_TYPE_ROLE_HINTS, EAN_VALUE_PATTERNS } from '../knowledge/field-patterns.js';
import type { ColumnInput, FieldRole, FieldRoleAssignment, ScoringReason } from '../types/index.js';

export class FieldClassifier {
  classifyColumn(
    col: ColumnInput,
    sampleValues: readonly string[] = [],
  ): FieldRoleAssignment {
    const colLower = col.name.toLowerCase();
    const dtLower  = col.dataType.toLowerCase();
    const reasons: ScoringReason[] = [];

    let bestRole: FieldRole  = 'UNKNOWN';
    let bestWeight           = 0;

    // ─── Name-based matching ─────────────────────────────────────────────
    for (const { patterns, role, weight } of FIELD_PATTERNS) {
      const matched = patterns.some((p) => colLower === p || colLower.endsWith(p) || colLower.startsWith(p) || colLower.includes(p));
      if (matched) {
        reasons.push({ signal: 'column_name', weight, detail: `column "${col.name}" matches ${role} pattern` });
        if (weight > bestWeight) { bestWeight = weight; bestRole = role; }
      }
    }

    // ─── Data type hints ─────────────────────────────────────────────────
    for (const { types, roles, weight } of DATA_TYPE_ROLE_HINTS) {
      if (types.some((t) => dtLower.includes(t))) {
        for (const role of roles) {
          if (weight > bestWeight) {
            reasons.push({ signal: 'data_type', weight, detail: `data type "${col.dataType}" hints at ${role}` });
            bestWeight = weight;
            bestRole   = role;
          }
        }
      }
    }

    // ─── Sample value-based override ─────────────────────────────────────
    if (sampleValues.length > 0) {
      const eanHits = sampleValues.filter((v) => EAN_VALUE_PATTERNS.some((re) => re.test(v.trim())));
      if (eanHits.length >= Math.ceil(sampleValues.length * 0.5)) {
        reasons.push({ signal: 'sample_ean', weight: 95, detail: `${eanHits.length}/${sampleValues.length} values match EAN pattern` });
        bestRole   = 'EAN';
        bestWeight = 95;
      }
    }

    // ─── Boolean → FLAG ──────────────────────────────────────────────────
    if (bestRole === 'UNKNOWN' && (dtLower === 'boolean' || dtLower === 'bool' || dtLower === 'bit')) {
      bestRole   = 'FLAG';
      bestWeight = 50;
      reasons.push({ signal: 'bool_type', weight: 50, detail: `boolean column "${col.name}" classified as FLAG` });
    }

    return {
      columnName:  col.name,
      role:        bestRole,
      confidence:  Math.min(100, bestWeight),
      reasons,
    };
  }

  classifyAll(
    columns: readonly ColumnInput[],
    samplesByColumn: Readonly<Record<string, readonly string[]>> = {},
  ): readonly FieldRoleAssignment[] {
    return columns.map((c) => this.classifyColumn(c, samplesByColumn[c.name] ?? []));
  }
}
