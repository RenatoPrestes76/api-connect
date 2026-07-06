/**
 * RelationshipAnalyzer — discovers and classifies all relationships between tables.
 *
 * Detection rules:
 *  ONE_TO_ONE   — FK column is also part of the target's PK; both ends unique
 *  ONE_TO_MANY  — standard FK (default)
 *  MANY_TO_MANY — junction table (2 FK columns = composite PK, no other data cols)
 *  RECURSIVE    — FK references the same table
 *  HIERARCHICAL — FK + parent/hierarchy column naming (pai, parent, superior, nivel)
 *  CIRCULAR     — A → B → ... → A (detected via BFS traversal)
 */
import type {
  DiscoveredRelationship,
  EntityType,
  RelationshipKind,
  CardinalityLabel,
  ScoringReason,
  TableInput,
} from '../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tableKey(schema: string, name: string): string {
  return `${schema}.${name}`;
}

function isHierarchicalColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return (
    lower.includes('pai') || lower.includes('parent') ||
    lower.includes('superior') || lower.includes('nivel') ||
    lower.includes('level') || lower.includes('hierarquia') ||
    lower.includes('hierarchy') || lower.includes('filho') ||
    lower.includes('child') || lower.includes('raiz') || lower.includes('root')
  );
}

function isJunctionTable(table: TableInput): boolean {
  if (table.foreignKeys.length !== 2) return false;
  const fkColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns));
  const pkColumns = new Set(table.primaryKey?.columns ?? []);
  if (fkColumns.size !== 2 || pkColumns.size !== 2) return false;
  for (const col of fkColumns) {
    if (!pkColumns.has(col)) return false;
  }
  return true;
}

function hasUniqueIndex(table: TableInput, columns: readonly string[]): boolean {
  return table.indexes.some(
    (idx) =>
      idx.isUnique &&
      idx.columns.length === columns.length &&
      columns.every((c) => idx.columns.includes(c)),
  );
}

// ─── Circular reference detection ────────────────────────────────────────────

function detectCircularRefs(
  tables: readonly TableInput[],
): Set<string> {
  const adj = new Map<string, string[]>();

  for (const table of tables) {
    const from = tableKey(table.schema, table.name);
    adj.set(from, []);
    for (const fk of table.foreignKeys) {
      const to = tableKey(fk.referencedSchema, fk.referencedTable);
      if (to !== from) {
        adj.get(from)!.push(to);
      }
    }
  }

  const inCycle = new Set<string>();

  // DFS to find cycles
  const visited  = new Set<string>();
  const stack    = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      // Found cycle — mark all nodes in the cycle
      const cycleStart = path.indexOf(node);
      for (const n of path.slice(cycleStart)) {
        inCycle.add(n);
      }
      inCycle.add(node);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const neighbor of adj.get(node) ?? []) {
      dfs(neighbor, [...path]);
    }

    stack.delete(node);
  }

  for (const node of adj.keys()) {
    dfs(node, []);
  }

  return inCycle;
}

// ─── Main Analyzer ────────────────────────────────────────────────────────────

export class RelationshipAnalyzer {
  analyze(
    tables: readonly TableInput[],
    _entityHints: Readonly<Partial<Record<string, EntityType>>> = {},
  ): readonly DiscoveredRelationship[] {
    const results: DiscoveredRelationship[] = [];
    const tableMap = new Map<string, TableInput>();

    for (const table of tables) {
      tableMap.set(tableKey(table.schema, table.name), table);
    }

    const circularKeys = detectCircularRefs(tables);

    // Process N:N junction tables first
    for (const table of tables) {
      if (!isJunctionTable(table)) continue;

      const [fk1, fk2] = table.foreignKeys;
      if (!fk1 || !fk2) continue;

      const from = tableKey(fk1.referencedSchema, fk1.referencedTable);
      const to   = tableKey(fk2.referencedSchema, fk2.referencedTable);

      results.push(makeRelationship(
        fk1.referencedSchema, fk1.referencedTable, fk1.referencedColumns[0] ?? 'id',
        fk2.referencedSchema, fk2.referencedTable, fk2.referencedColumns[0] ?? 'id',
        'MANY_TO_MANY', 'N:N',
        `junction:${table.name}`,
        90,
        [`Junction table "${table.name}" connects ${from} ↔ ${to}`],
      ));
    }

    // Process regular FKs
    for (const table of tables) {
      const fromKey = tableKey(table.schema, table.name);

      for (const fk of table.foreignKeys) {
        const toKey = tableKey(fk.referencedSchema, fk.referencedTable);

        // Recursive
        if (toKey === fromKey) {
          const hierarchical = fk.columns.some(isHierarchicalColumn);
          results.push(makeRelationship(
            table.schema, table.name, fk.columns[0] ?? '',
            fk.referencedSchema, fk.referencedTable, fk.referencedColumns[0] ?? '',
            hierarchical ? 'HIERARCHICAL' : 'RECURSIVE',
            'N:1',
            fk.constraintName,
            85,
            [hierarchical ? `Column "${fk.columns[0]}" suggests parent-child hierarchy` : `Self-referencing FK`],
          ));
          continue;
        }

        // Circular (but not recursive)
        if (circularKeys.has(fromKey) && circularKeys.has(toKey)) {
          results.push(makeRelationship(
            table.schema, table.name, fk.columns[0] ?? '',
            fk.referencedSchema, fk.referencedTable, fk.referencedColumns[0] ?? '',
            'CIRCULAR', 'N:1',
            fk.constraintName,
            75,
            [`"${table.name}" is part of a circular reference cycle`],
          ));
          continue;
        }

        // Skip tables processed as N:N (junctions)
        if (isJunctionTable(table)) continue;

        // 1:1 — FK column is unique on both ends
        const fkColsUnique = hasUniqueIndex(table, fk.columns);
        if (fkColsUnique) {
          results.push(makeRelationship(
            table.schema, table.name, fk.columns[0] ?? '',
            fk.referencedSchema, fk.referencedTable, fk.referencedColumns[0] ?? '',
            'ONE_TO_ONE', '1:1',
            fk.constraintName,
            80,
            [`Unique index on FK column(s) ${fk.columns.join(', ')} indicates 1:1`],
          ));
          continue;
        }

        // Standard 1:N
        results.push(makeRelationship(
          table.schema, table.name, fk.columns[0] ?? '',
          fk.referencedSchema, fk.referencedTable, fk.referencedColumns[0] ?? '',
          'ONE_TO_MANY', 'N:1',
          fk.constraintName,
          95,
          [`Standard FK "${fk.constraintName}" from ${table.name} to ${fk.referencedTable}`],
        ));
      }
    }

    return results;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeRelationship(
  fromSchema: string, fromTable: string, fromColumn: string,
  toSchema:   string, toTable:   string, toColumn:   string,
  kind:        RelationshipKind,
  cardinality: CardinalityLabel,
  constraintName: string,
  confidence:  number,
  reasonDetails: string[],
): DiscoveredRelationship {
  const reasons: ScoringReason[] = reasonDetails.map((d) => ({
    signal: 'relationship',
    weight: confidence,
    detail: d,
  }));

  return {
    fromSchema, fromTable, fromColumn,
    toSchema,   toTable,   toColumn,
    kind, cardinality, constraintName, confidence, reasons,
  };
}
