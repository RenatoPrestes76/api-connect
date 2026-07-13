/**
 * KnowledgeGraph — in-memory directed graph of database entities.
 *
 * Nodes represent classified tables; edges represent discovered relationships.
 * Provides BFS/DFS traversal, neighbour lookup, and subgraph extraction.
 */
import type {
  EntityClassification,
  EntityType,
  KnowledgeEdge,
  KnowledgeNode,
  RelationshipKind,
} from '../types/index.js';

export class KnowledgeGraph {
  private readonly _nodes = new Map<string, KnowledgeNode>();
  private readonly _adjOut = new Map<string, KnowledgeEdge[]>();
  private readonly _adjIn = new Map<string, KnowledgeEdge[]>();

  // ─── Mutations ─────────────────────────────────────────────────────────────

  addNode(classification: EntityClassification): void {
    const id = nodeId(classification.tableSchema, classification.tableName);
    this._nodes.set(id, {
      id,
      entity: classification.entity,
      confidence: classification.confidence,
      classification,
    });
    if (!this._adjOut.has(id)) this._adjOut.set(id, []);
    if (!this._adjIn.has(id)) this._adjIn.set(id, []);
  }

  addEdge(edge: KnowledgeEdge): void {
    if (!this._adjOut.has(edge.fromId)) this._adjOut.set(edge.fromId, []);
    if (!this._adjIn.has(edge.toId)) this._adjIn.set(edge.toId, []);

    this._adjOut.get(edge.fromId)!.push(edge);
    this._adjIn.get(edge.toId)!.push(edge);
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  node(id: string): KnowledgeNode | undefined {
    return this._nodes.get(id);
  }

  allNodes(): readonly KnowledgeNode[] {
    return [...this._nodes.values()];
  }

  allEdges(): readonly KnowledgeEdge[] {
    const seen = new Set<string>();
    const edges: KnowledgeEdge[] = [];
    for (const list of this._adjOut.values()) {
      for (const e of list) {
        const key = `${e.fromId}→${e.toId}:${e.kind}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push(e);
        }
      }
    }
    return edges;
  }

  /** All nodes classified as a given entity type, sorted by confidence desc. */
  nodesByEntity(entity: EntityType): readonly KnowledgeNode[] {
    return [...this._nodes.values()]
      .filter((n) => n.entity === entity)
      .sort((a, b) => b.confidence - a.confidence);
  }

  outgoing(id: string): readonly KnowledgeEdge[] {
    return this._adjOut.get(id) ?? [];
  }

  incoming(id: string): readonly KnowledgeEdge[] {
    return this._adjIn.get(id) ?? [];
  }

  neighbours(id: string): readonly KnowledgeNode[] {
    const ids = new Set<string>();
    for (const e of [...(this._adjOut.get(id) ?? []), ...(this._adjIn.get(id) ?? [])]) {
      const other = e.fromId === id ? e.toId : e.fromId;
      ids.add(other);
    }
    return [...ids].map((i) => this._nodes.get(i)).filter((n): n is KnowledgeNode => !!n);
  }

  /** BFS from a starting node; returns nodes in visit order. */
  bfs(startId: string, maxDepth = 3): readonly KnowledgeNode[] {
    const visited = new Set<string>([startId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    const result: KnowledgeNode[] = [];

    while (queue.length > 0) {
      const item = queue.shift()!;
      const node = this._nodes.get(item.id);
      if (node) result.push(node);
      if (item.depth >= maxDepth) continue;

      for (const n of this.neighbours(item.id)) {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          queue.push({ id: n.id, depth: item.depth + 1 });
        }
      }
    }

    return result;
  }

  /** Edges of a given relationship kind. */
  edgesByKind(kind: RelationshipKind): readonly KnowledgeEdge[] {
    return this.allEdges().filter((e) => e.kind === kind);
  }

  get nodeCount(): number {
    return this._nodes.size;
  }
  get edgeCount(): number {
    return this.allEdges().length;
  }
}

export function nodeId(schema: string, table: string): string {
  return `${schema}.${table}`;
}
