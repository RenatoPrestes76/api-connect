/**
 * GraphBuilder — constructs the KnowledgeGraph from classified tables + relationships.
 */
import { KnowledgeGraph, nodeId } from './graph.js';
import type {
  DiscoveredRelationship,
  EntityClassification,
  RelationshipKind,
} from '../types/index.js';

export class GraphBuilder {
  build(
    classifications: readonly EntityClassification[],
    relationships: readonly DiscoveredRelationship[]
  ): KnowledgeGraph {
    const graph = new KnowledgeGraph();

    for (const cls of classifications) {
      graph.addNode(cls);
    }

    for (const rel of relationships) {
      const fromId = nodeId(rel.fromSchema, rel.fromTable);
      const toId = nodeId(rel.toSchema, rel.toTable);

      const avgConf = rel.confidence;
      const label = `${rel.fromTable} → ${rel.toTable} (${rel.kind})`;

      graph.addEdge({
        fromId,
        toId,
        kind: rel.kind,
        cardinality: rel.cardinality,
        label,
        confidence: avgConf,
      });
    }

    return graph;
  }
}
