/**
 * ColumnScorer — scores a table's entity type based on its column composition.
 *
 * Logic:
 *  1. For each column, find matching FIELD_PATTERNS
 *  2. Map FieldRole → EntityType signals (some roles strongly suggest an entity)
 *  3. Aggregate and normalize across all columns
 */
import { FIELD_PATTERNS } from '../knowledge/field-patterns.js';
import type {
  ColumnInput,
  EntityType,
  FieldRole,
  FieldRoleAssignment,
  ScoreMap,
  ScoringReason,
} from '../types/index.js';

// ─── Role → Entity signal mapping ────────────────────────────────────────────

const ROLE_ENTITY_SIGNALS: Readonly<Partial<Record<FieldRole, Array<[EntityType, number]>>>> = {
  EAN: [['PRODUCT', 80]],
  SKU: [['PRODUCT', 70]],
  COST_PRICE: [
    ['PRODUCT', 60],
    ['PRICE', 50],
  ],
  SALE_PRICE: [
    ['PRODUCT', 60],
    ['PRICE', 60],
    ['SALE', 30],
  ],
  PRICE: [
    ['PRICE', 50],
    ['PRODUCT', 30],
    ['SALE', 20],
  ],
  MARGIN: [
    ['PRODUCT', 40],
    ['PRICE', 50],
  ],
  BALANCE: [
    ['INVENTORY', 70],
    ['PRODUCT', 20],
  ],
  QUANTITY: [
    ['INVENTORY', 50],
    ['MOVEMENT', 40],
    ['SALE', 30],
  ],
  EXPIRY_DATE: [
    ['EXPIRY', 90],
    ['LOT', 40],
  ],
  MANUFACTURE_DATE: [['LOT', 60]],
  WEIGHT: [['PRODUCT', 50]],
  BRAND: [['PRODUCT', 40]],
  SUPPLIER_FK: [
    ['PRODUCT', 40],
    ['PURCHASE', 50],
    ['SUPPLIER', 20],
  ],
  CATEGORY_FK: [
    ['PRODUCT', 40],
    ['CATEGORY', 30],
  ],
  BRANCH_FK: [
    ['INVENTORY', 40],
    ['SALE', 30],
    ['BRANCH', 20],
  ],
  CUSTOMER_FK: [
    ['SALE', 60],
    ['CUSTOMER', 30],
  ],
  PRODUCT_FK: [
    ['INVENTORY', 50],
    ['SALE', 50],
    ['MOVEMENT', 40],
    ['PRICE', 40],
  ],
  FLAG: [
    ['PRODUCT', 10],
    ['USER', 10],
    ['CONFIGURATION', 20],
  ],
  STATUS: [
    ['SALE', 20],
    ['PURCHASE', 20],
    ['MOVEMENT', 10],
  ],
  SOFT_DELETE: [
    ['CUSTOMER', 15],
    ['PRODUCT', 15],
    ['USER', 15],
  ],
  TIMESTAMP_CREATED: [
    ['SALE', 10],
    ['PURCHASE', 10],
    ['MOVEMENT', 10],
  ],
};

export interface ColumnScoreResult {
  readonly scores: ScoreMap;
  readonly reasons: readonly ScoringReason[];
  readonly fieldRoles: readonly FieldRoleAssignment[];
}

export class ColumnScorer {
  score(columns: readonly ColumnInput[]): ColumnScoreResult {
    const accumulated: Record<EntityType, number> = {} as Record<EntityType, number>;
    const reasons: ScoringReason[] = [];
    const assignments: FieldRoleAssignment[] = [];

    for (const col of columns) {
      const colLower = col.name.toLowerCase();
      let bestRole: FieldRole = 'UNKNOWN';
      let bestWeight = 0;
      const colReasons: ScoringReason[] = [];

      for (const { patterns, role, weight } of FIELD_PATTERNS) {
        const matched = patterns.some((p) => colLower.includes(p) || colLower === p);
        if (matched) {
          colReasons.push({
            signal: 'column_name',
            weight,
            detail: `column "${col.name}" matches pattern for ${role}`,
          });
          if (weight > bestWeight) {
            bestWeight = weight;
            bestRole = role;
          }
        }
      }

      // Apply column type hints (if no strong match yet)
      if (bestWeight < 60) {
        const dtLower = col.dataType.toLowerCase();
        if (dtLower.includes('numeric') || dtLower.includes('decimal')) {
          if (
            colLower.includes('preco') ||
            colLower.includes('price') ||
            colLower.includes('vl_')
          ) {
            colReasons.push({
              signal: 'column_type',
              weight: 30,
              detail: `numeric column "${col.name}" hints at PRICE role`,
            });
            if (30 > bestWeight) {
              bestWeight = 30;
              bestRole = 'PRICE';
            }
          }
        }
      }

      assignments.push({
        columnName: col.name,
        role: bestRole,
        confidence: Math.min(100, bestWeight),
        reasons: colReasons,
      });

      // Propagate role signal to entity scores
      const signals = ROLE_ENTITY_SIGNALS[bestRole];
      if (signals && bestWeight > 0) {
        for (const [entity, points] of signals) {
          const contribution = Math.round((points * bestWeight) / 100);
          accumulated[entity] = (accumulated[entity] ?? 0) + contribution;
          if (contribution > 10) {
            reasons.push({
              signal: 'column_role',
              weight: contribution,
              detail: `column "${col.name}" (role: ${bestRole}) adds ${contribution}pts to ${entity}`,
            });
          }
        }
      }
    }

    // Normalize: cap at 100, apply column count penalty for very wide tables
    const scores: ScoreMap = {};
    const colCount = columns.length;
    const spreadFactor = colCount > 50 ? 0.8 : colCount > 20 ? 0.9 : 1.0;

    for (const [k, v] of Object.entries(accumulated) as [EntityType, number][]) {
      scores[k] = Math.min(100, Math.round(v * spreadFactor));
    }

    return { scores, reasons, fieldRoles: assignments };
  }
}
