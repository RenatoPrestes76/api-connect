/**
 * @seltriva/semantic-engine/knowledge-graph
 * Business Knowledge Graph — relationships between CBL concepts
 *
 * The knowledge graph encodes what the USME "knows" about how business
 * concepts relate to each other. It is used to:
 *
 * 1. Validate coherence: if an entity is mapped to ENTITY_PRODUCT, it is
 *    expected to have a relationship to ENTITY_CATEGORY and ENTITY_SUPPLIER.
 *    If those FK targets are mapped to something else, the graph flags it.
 *
 * 2. Guide suggestions: when analyzing an unmapped entity, the graph can
 *    suggest which CBL fields are likely based on what neighboring entities
 *    are already mapped to.
 *
 * 3. Explain suggestions: "This field was suggested as FIELD_SUPPLIER because
 *    the entity is mapped to ENTITY_PRODUCT and the graph expects a SUPPLIER
 *    relationship from PRODUCT."
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLRelationshipKind,
  CBLDomainKind,
} from '../business-language/index';
import type { SemanticResult } from '../business-language/index';
import type { ConfidenceValue } from '../confidence-engine/index';

// ─── Business Knowledge Graph ─────────────────────────────────────────────

export interface BusinessKnowledgeGraph {
  /**
   * Get all expected fields for a given entity kind
   */
  getExpectedFields(entityKind: CBLEntityKind): ExpectedField[];

  /**
   * Get all expected relationships for an entity kind
   */
  getExpectedRelationships(entityKind: CBLEntityKind): ExpectedRelationship[];

  /**
   * Given a mapped entity, score the coherence of its current field mappings
   * against what the graph expects
   */
  scoreCoherence(entityKind: CBLEntityKind, mappedFields: CBLFieldKind[]): GraphCoherenceScore;

  /**
   * Query the graph for entities that are related to a given entity kind
   */
  getRelatedEntities(entityKind: CBLEntityKind): RelatedEntityResult[];

  /**
   * Find entity kinds that commonly contain the given field kind
   */
  getEntitiesForField(fieldKind: CBLFieldKind): EntityFieldAssociation[];

  /**
   * Traverse the graph to find multi-hop relationships
   */
  traverse(from: CBLEntityKind, options?: GraphTraversalOptions): GraphPath[];

  /**
   * Check whether two entity kinds are directly related
   */
  areRelated(a: CBLEntityKind, b: CBLEntityKind): boolean;

  /**
   * Get the shortest relationship path between two entity kinds
   */
  shortestPath(from: CBLEntityKind, to: CBLEntityKind): GraphPath | null;

  /**
   * Register a custom graph node (extends the built-in graph)
   */
  registerNode(node: GraphNode): void;

  /**
   * Register a custom graph edge
   */
  registerEdge(edge: GraphEdge): void;

  /**
   * Query the graph with a predicate
   */
  query(predicate: GraphPredicate): GraphQueryResult;
}

// ─── Graph Nodes ──────────────────────────────────────────────────────────

/**
 * A node represents a CBL entity in the knowledge graph.
 */
export interface GraphNode {
  readonly entityKind: CBLEntityKind;
  readonly term: CBLEntityTerm;
  readonly domain: CBLDomainKind;
  readonly centralityScore: number;
  readonly isHubEntity: boolean;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

// ─── Graph Edges ──────────────────────────────────────────────────────────

/**
 * An edge represents a business relationship between two entity kinds.
 */
export interface GraphEdge {
  readonly id: string;
  readonly relationshipKind: CBLRelationshipKind;
  readonly sourceKind: CBLEntityKind;
  readonly targetKind: CBLEntityKind;
  readonly cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  readonly weight: number;
  readonly isMandatory: boolean;
  readonly isDirected: boolean;
  readonly typicalFieldBridge?: CBLFieldKind;
  readonly description?: string;
}

// ─── Expected Fields / Relationships ─────────────────────────────────────

export interface ExpectedField {
  readonly fieldKind: CBLFieldKind;
  readonly term: CBLFieldTerm;
  readonly expectation: FieldExpectation;
  readonly confidence: ConfidenceValue;
  readonly reason: string;
}

export type FieldExpectation = 'required' | 'common' | 'optional' | 'rarely-present';

export interface ExpectedRelationship {
  readonly relationshipKind: CBLRelationshipKind;
  readonly targetEntityKind: CBLEntityKind;
  readonly targetTerm: CBLEntityTerm;
  readonly cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  readonly isMandatory: boolean;
  readonly confidence: ConfidenceValue;
  readonly reason: string;
}

// ─── Related Entity ───────────────────────────────────────────────────────

export interface RelatedEntityResult {
  readonly entityKind: CBLEntityKind;
  readonly term: CBLEntityTerm;
  readonly relationshipKind: CBLRelationshipKind;
  readonly cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  readonly direction: 'outbound' | 'inbound' | 'bidirectional';
  readonly strength: ConfidenceValue;
}

export interface EntityFieldAssociation {
  readonly entityKind: CBLEntityKind;
  readonly frequency: ConfidenceValue;
  readonly expectation: FieldExpectation;
}

// ─── Graph Coherence ──────────────────────────────────────────────────────

export interface GraphCoherenceScore {
  readonly entityKind: CBLEntityKind;
  readonly score: ConfidenceValue;
  readonly presentExpectedFields: CBLFieldKind[];
  readonly missingExpectedFields: MissingExpectedField[];
  readonly unexpectedFields: CBLFieldKind[];
  readonly verdict: 'coherent' | 'mostly-coherent' | 'incomplete' | 'incoherent';
}

export interface MissingExpectedField {
  readonly fieldKind: CBLFieldKind;
  readonly expectation: FieldExpectation;
  readonly suggestion: string;
}

// ─── Graph Traversal ──────────────────────────────────────────────────────

export interface GraphTraversalOptions {
  readonly maxDepth?: number;
  readonly direction?: 'outbound' | 'inbound' | 'both';
  readonly domains?: CBLDomainKind[];
  readonly minEdgeWeight?: number;
  readonly followMandatoryOnly?: boolean;
}

export interface GraphPath {
  readonly nodes: CBLEntityKind[];
  readonly edges: GraphEdge[];
  readonly totalWeight: number;
  readonly depth: number;
}

// ─── Graph Query ──────────────────────────────────────────────────────────

export type GraphPredicate = (node: GraphNode, edges: GraphEdge[]) => boolean;

export interface GraphQueryResult {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
  readonly count: number;
}

// ─── Graph Statistics ─────────────────────────────────────────────────────

export interface GraphStatistics {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly mandatoryEdges: number;
  readonly optionalEdges: number;
  readonly hubEntities: CBLEntityKind[];
  readonly disconnectedNodes: CBLEntityKind[];
  readonly averageDegree: number;
  readonly domains: CBLDomainKind[];
}

export interface KnowledgeGraphAnalyzer {
  computeStatistics(graph: BusinessKnowledgeGraph): GraphStatistics;
  findClusters(graph: BusinessKnowledgeGraph): GraphCluster[];
  findHubEntities(graph: BusinessKnowledgeGraph): GraphNode[];
}

export interface GraphCluster {
  readonly domain: CBLDomainKind;
  readonly entities: CBLEntityKind[];
  readonly internalEdgeCount: number;
  readonly externalEdgeCount: number;
}
