/**
 * RelationshipScorer — scores entity type from FK relationships.
 *
 * The idea: if a table has a FK pointing to a "produto" table, it's likely
 * INVENTORY or SALE. If it IS pointed to by many tables, it's likely a
 * master-data entity (PRODUCT, SUPPLIER, CUSTOMER, CATEGORY).
 */
import type { EntityType, ForeignKeyInput, ScoreMap, ScoringReason, TableInput } from '../types/index.js';
import { normalizeTableName } from '../knowledge/entity-patterns.js';

// Signals fired when a FK references a table whose name matches an entity
const FK_TARGET_SIGNALS: Readonly<Partial<Record<EntityType, Array<[EntityType, number]>>>> = {
  PRODUCT:    [['INVENTORY', 50], ['SALE', 40], ['MOVEMENT', 40], ['PRICE', 40]],
  SUPPLIER:   [['PURCHASE', 50], ['PRODUCT', 30]],
  CUSTOMER:   [['SALE', 60]],
  CATEGORY:   [['PRODUCT', 30]],
  BRANCH:     [['INVENTORY', 40], ['SALE', 30], ['MOVEMENT', 30]],
  PRICE:      [['SALE', 20]],
  EXPIRY:     [['INVENTORY', 30], ['LOT', 40]],
  LOT:        [['INVENTORY', 30], ['EXPIRY', 30]],
  USER:       [['AUDIT', 30], ['LOG', 20], ['PERMISSION', 20]],
  PERMISSION: [['USER', 30]],
};

// Being referenced by many tables increases master-data confidence
const MASTER_DATA_ENTITIES: readonly EntityType[] = [
  'PRODUCT', 'SUPPLIER', 'CUSTOMER', 'CATEGORY', 'BRANCH', 'USER',
];

export interface RelationshipScoreResult {
  readonly scores:  ScoreMap;
  readonly reasons: readonly ScoringReason[];
}

export class RelationshipScorer {
  /**
   * @param allTables All tables in the same schema, used to count back-references.
   */
  score(
    table: TableInput,
    entityHints: Readonly<Partial<Record<string, EntityType>>>,
    allTables: readonly TableInput[],
  ): RelationshipScoreResult {
    const accumulated: Record<EntityType, number> = {} as Record<EntityType, number>;
    const reasons: ScoringReason[] = [];

    // ─── Outgoing FKs ────────────────────────────────────────────────────
    for (const fk of table.foreignKeys) {
      const targetNorm = normalizeTableName(fk.referencedTable);
      const targetEntity = entityHints[`${fk.referencedSchema}.${fk.referencedTable}`]
                        ?? entityHints[fk.referencedTable];

      if (targetEntity) {
        const signals = FK_TARGET_SIGNALS[targetEntity];
        if (signals) {
          for (const [entity, pts] of signals) {
            accumulated[entity] = (accumulated[entity] ?? 0) + pts;
            reasons.push({
              signal: 'outgoing_fk',
              weight: pts,
              detail: `FK to ${fk.referencedTable} (${targetEntity}) adds ${pts}pts to ${entity}`,
            });
          }
        }
      } else {
        // Fall back to name-based hint for the referenced table
        for (const [ent, pts] of guessEntityFromName(targetNorm)) {
          const reduced = Math.round(pts * 0.5);
          accumulated[ent] = (accumulated[ent] ?? 0) + reduced;
          reasons.push({
            signal: 'outgoing_fk_name',
            weight: reduced,
            detail: `FK to "${fk.referencedTable}" (name suggests ${ent}) adds ${reduced}pts`,
          });
        }
      }
    }

    // ─── Incoming FKs (tables that reference this one) ────────────────────
    const tableKey = `${table.schema}.${table.name}`;
    const tableName = table.name.toLowerCase();
    let incomingCount = 0;

    for (const other of allTables) {
      if (other.name === table.name && other.schema === table.schema) continue;
      for (const fk of other.foreignKeys) {
        if (
          (fk.referencedTable === table.name && fk.referencedSchema === table.schema) ||
          fk.referencedTable === table.name
        ) {
          incomingCount++;
        }
      }
    }

    if (incomingCount >= 5) {
      // Heavily referenced → likely master data
      for (const ent of MASTER_DATA_ENTITIES) {
        const pts = Math.min(40, incomingCount * 5);
        accumulated[ent] = (accumulated[ent] ?? 0) + pts;
      }
      reasons.push({
        signal: 'incoming_fks',
        weight: Math.min(40, incomingCount * 5),
        detail: `${incomingCount} tables reference "${tableKey}" — suggests master data entity`,
      });
    } else if (incomingCount === 0 && table.foreignKeys.length >= 2) {
      // Many outgoing FKs, no incoming → likely a transactional / junction table
      const pts = 20;
      accumulated['MOVEMENT'] = (accumulated['MOVEMENT'] ?? 0) + pts;
      accumulated['SALE']     = (accumulated['SALE']     ?? 0) + pts;
      reasons.push({
        signal: 'no_incoming_fks',
        weight: pts,
        detail: `"${tableName}" has ${table.foreignKeys.length} outgoing FKs and 0 incoming — likely transactional`,
      });
    }

    const scores: ScoreMap = {};
    for (const [k, v] of Object.entries(accumulated) as [EntityType, number][]) {
      scores[k] = Math.min(100, v);
    }

    return { scores, reasons };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessEntityFromName(normalizedName: string): Array<[EntityType, number]> {
  const hints: Array<[EntityType, number]> = [];

  if (/prod|item|sku|article|mercad/.test(normalizedName)) hints.push(['PRODUCT', 60]);
  if (/forne|supplier|vendor/.test(normalizedName))         hints.push(['SUPPLIER', 60]);
  if (/categ|grupo|familia|classe/.test(normalizedName))    hints.push(['CATEGORY', 60]);
  if (/client|customer|pessoa/.test(normalizedName))        hints.push(['CUSTOMER', 60]);
  if (/filial|loja|store|branch/.test(normalizedName))      hints.push(['BRANCH', 60]);
  if (/estoque|stock|saldo/.test(normalizedName))           hints.push(['INVENTORY', 60]);
  if (/pedido|venda|sale|order/.test(normalizedName))       hints.push(['SALE', 60]);
  if (/compra|purchase/.test(normalizedName))               hints.push(['PURCHASE', 60]);
  if (/validade|expiry/.test(normalizedName))               hints.push(['EXPIRY', 60]);
  if (/lote|batch|serie/.test(normalizedName))              hints.push(['LOT', 60]);
  if (/usuario|user|operador/.test(normalizedName))         hints.push(['USER', 60]);

  return hints;
}
