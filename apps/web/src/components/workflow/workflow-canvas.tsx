'use client';
import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge, OnConnect, NodeTypes, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { randomUUID } from './canvas-utils';
import { WorkflowNodeComponent } from './workflow-node';
import type {
  WorkflowGraph,
  WorkflowNode as WNode,
  WorkflowEdge as WEdge,
  NodeType,
} from '@/types/workflow';

// ─── Convert between internal and React Flow types ───────────────────────────

function toRFNode(n: WNode): Node {
  return {
    id: n.id,
    type: 'workflowNode',
    position: n.position,
    data: { label: n.label, nodeType: n.type, config: n.config },
  };
}

function toRFEdge(e: WEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    sourceHandle: e.label === 'true' ? 'true' : e.label === 'false' ? 'false' : undefined,
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: '#64748b' },
  };
}

function toWNode(n: Node, type: NodeType): WNode {
  return {
    id: n.id,
    type,
    label: (n.data.label as string) ?? 'Node',
    config: (n.data.config as Record<string, unknown>) ?? {},
    position: n.position,
  };
}

function toWEdge(e: Edge): WEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: typeof e.label === 'string' ? e.label : undefined,
  };
}

// ─── Node types registry ──────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  workflowNode: WorkflowNodeComponent as unknown as NodeTypes[string],
};

// ─── WorkflowCanvas ───────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  onChange: (graph: WorkflowGraph) => void;
  onSelectNode: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

export function WorkflowCanvas({
  graph,
  onChange,
  onSelectNode,
  selectedNodeId,
}: WorkflowCanvasProps) {
  const initialNodes = useMemo(() => graph.nodes.map(toRFNode), []);
  const initialEdges = useMemo(() => graph.edges.map(toRFEdge), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const emitChange = useCallback(
    (ns: Node[], es: Edge[]) => {
      const wNodes: WNode[] = ns.map((n) => toWNode(n, (n.data.nodeType as NodeType) ?? 'log'));
      const wEdges: WEdge[] = es.map(toWEdge);
      onChange({ nodes: wNodes, edges: wEdges });
    },
    [onChange]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: randomUUID(),
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      } as Edge;
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        emitChange(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, emitChange]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/workflow-node-type') as NodeType;
      if (!type) return;

      const target = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - target.left - 70,
        y: event.clientY - target.top - 20,
      };

      const id = randomUUID();
      const newNode: Node = {
        id,
        type: 'workflowNode',
        position,
        data: { label: capitalize(type), nodeType: type, config: defaultConfig(type) },
      };

      setNodes((ns) => {
        const next = [...ns, newNode];
        emitChange(next, edges);
        return next;
      });
    },
    [setNodes, edges, emitChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, selectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Sync node positions back to graph on change
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // Emit on position change
      setNodes((ns) => {
        emitChange(ns, edges);
        return ns;
      });
    },
    [onNodesChange, setNodes, edges, emitChange]
  );

  return (
    <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          setEdges((es) => {
            emitChange(nodes, es);
            return es;
          });
        }}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const type = (n.data?.nodeType as string) ?? '';
            if (
              [
                'trigger',
                'webhook',
                'schedule',
                'file-watch',
                'email-trigger',
                'api-trigger',
                'queue-trigger',
                'manual-trigger',
              ].includes(type)
            )
              return '#6366f1';
            if (
              [
                'ai-classify',
                'ai-extract',
                'ai-generate',
                'ai-translate',
                'ai-summarize',
                'ai-embed',
              ].includes(type)
            )
              return '#22c55e';
            if (
              ['http', 'notification', 'database-write', 'file-write', 'log', 'dlq'].includes(type)
            )
              return '#10b981';
            const COLORS: Record<string, string> = {
              transform: '#0ea5e9',
              validate: '#8b5cf6',
              condition: '#f59e0b',
              delay: '#64748b',
              retry: '#f97316',
              loop: '#d97706',
              aggregate: '#b45309',
              filter: '#92400e',
              merge: '#78716c',
              split: '#475569',
            };
            return COLORS[type] ?? '#94a3b8';
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
      </ReactFlow>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function defaultConfig(type: NodeType): Record<string, unknown> {
  const defaults: Partial<Record<NodeType, Record<string, unknown>>> = {
    // Sprint 29
    trigger: { triggerType: 'MANUAL' },
    transform: { expression: '', outputVar: '' },
    validate: { schema: '', failOnError: true },
    http: { method: 'GET', url: '', timeout: 15000 },
    condition: { expression: '' },
    delay: { durationMs: 5000 },
    retry: { maxAttempts: 3, backoffMs: 2000, strategy: 'exponential' },
    notification: { channel: 'email', to: '' },
    log: { level: 'info', message: '' },
    dlq: { reason: '' },
    // Sprint 32 — Entrada
    webhook: { path: '/webhook' },
    schedule: { cron: '0 * * * *' },
    'file-watch': { path: '/uploads', event: 'created' },
    'email-trigger': { folder: 'INBOX', filter: '' },
    'api-trigger': { path: '/api/trigger', method: 'POST' },
    'queue-trigger': { queue: 'default' },
    'manual-trigger': {},
    // Sprint 32 — Processamento
    loop: { itemsVar: 'items' },
    aggregate: { operation: 'sum', field: '' },
    filter: { expression: '' },
    merge: { strategy: 'concat' },
    split: { key: '' },
    // Sprint 32 — IA
    'ai-classify': { model: 'claude-opus-4-8', task: '' },
    'ai-extract': { model: 'claude-opus-4-8', fields: [] },
    'ai-generate': { model: 'claude-opus-4-8', template: '' },
    'ai-translate': { model: 'claude-opus-4-8', targetLang: 'en' },
    'ai-summarize': { model: 'claude-opus-4-8' },
    'ai-embed': { model: 'claude-opus-4-8', index: '' },
    // Sprint 32 — Saída
    'database-write': { table: '' },
    'file-write': { path: '/output/result.json' },
  };
  return defaults[type] ?? {};
}
