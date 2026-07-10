'use client';
import { use, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Sparkles, History, Play } from 'lucide-react';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas';
import { NodePalette } from '@/components/workflow/node-palette';
import { NodeConfigPanel } from '@/components/workflow/node-config-panel';
import { WorkflowToolbar } from '@/components/workflow/workflow-toolbar';
import { AiBuilderPanel } from '@/components/workflow/ai-builder-panel';
import { SimulationPanel } from '@/components/workflow/simulation-panel';
import { VersionSidebar } from '@/components/workflow/version-sidebar';
import {
  useWorkflow,
  useUpdateWorkflow,
  useActivateWorkflow,
  useDeactivateWorkflow,
  useRunWorkflow,
} from '@/hooks/use-workflows';
import type { WorkflowGraph, WorkflowNode } from '@/types/workflow';

type RightPanel = 'config' | 'ai' | 'simulate' | 'versions' | null;

export default function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: wf, isLoading, isError, error } = useWorkflow(id);
  const updateWf = useUpdateWorkflow();
  const activate = useActivateWorkflow();
  const deactivate = useDeactivateWorkflow();
  const runWf = useRunWorkflow();

  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);

  const effectiveGraph = graph ?? wf?.graph ?? null;

  const handleGraphChange = useCallback((g: WorkflowGraph) => {
    setGraph(g);
    setIsDirty(true);
  }, []);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setRightPanel(nodeId ? 'config' : null);
  }, []);

  const handleNodeConfigChange = useCallback(
    (node: WorkflowNode) => {
      if (!effectiveGraph) return;
      const nodes = effectiveGraph.nodes.map((n) => (n.id === node.id ? node : n));
      setGraph({ ...effectiveGraph, nodes });
      setIsDirty(true);
    },
    [effectiveGraph]
  );

  const selectedNode = effectiveGraph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleSave = async () => {
    if (!wf || !effectiveGraph) return;
    try {
      await updateWf.mutateAsync({
        id: wf.id,
        body: { graph: effectiveGraph, note: 'Saved from builder' },
      });
      setIsDirty(false);
      toast.success('Workflow saved');
    } catch {
      toast.error('Failed to save workflow');
    }
  };

  const handleRun = async () => {
    if (!wf) return;
    try {
      await runWf.mutateAsync({ id: wf.id });
      toast.success('Execution started');
    } catch {
      toast.error('Failed to start execution');
    }
  };

  const handleToggleActive = async () => {
    if (!wf) return;
    try {
      if (wf.active) {
        await deactivate.mutateAsync(wf.id);
        toast.success('Workflow deactivated');
      } else {
        await activate.mutateAsync(wf.id);
        toast.success('Workflow activated');
      }
    } catch {
      toast.error('Failed to toggle workflow status');
    }
  };

  const handleAiApply = (aiGraph: WorkflowGraph, name: string, _desc: string) => {
    setGraph(aiGraph);
    setIsDirty(true);
    setRightPanel(null);
    toast.success(`Workflow "${name}" aplicado no canvas`);
  };

  const togglePanel = (panel: Exclude<RightPanel, 'config' | null>) => {
    setRightPanel((prev) => (prev === panel ? null : panel));
    if (panel !== 'config') setSelectedNodeId(null);
  };

  if (isLoading) return <PageLoading message="Loading workflow…" />;
  if (isError)
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load workflow'} />;
  if (!wf || !effectiveGraph) return <ErrorState message="Workflow not found" />;

  return (
    <div className="flex h-full flex-col -m-6">
      <WorkflowToolbar
        workflow={wf}
        isDirty={isDirty}
        isSaving={updateWf.isPending}
        isRunning={runWf.isPending}
        onSave={handleSave}
        onRun={handleRun}
        onToggleActive={handleToggleActive}
      />

      {/* Builder toolbar row */}
      <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-1">
        <button
          onClick={() => togglePanel('ai')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            rightPanel === 'ai'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Builder
        </button>
        <button
          onClick={() => togglePanel('simulate')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            rightPanel === 'simulate'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          <Play className="h-3.5 w-3.5" />
          Simular
        </button>
        <button
          onClick={() => togglePanel('versions')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            rightPanel === 'versions'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Versões
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <NodePalette />

        <WorkflowCanvas
          graph={effectiveGraph}
          onChange={handleGraphChange}
          onSelectNode={handleSelectNode}
          selectedNodeId={selectedNodeId}
        />

        {/* Right panel — 280px wide */}
        {rightPanel === 'config' && selectedNode && (
          <div className="w-72 border-l overflow-y-auto shrink-0">
            <NodeConfigPanel
              node={selectedNode}
              onChange={handleNodeConfigChange}
              onClose={() => {
                setSelectedNodeId(null);
                setRightPanel(null);
              }}
            />
          </div>
        )}
        {rightPanel === 'ai' && (
          <div className="w-72 border-l overflow-hidden shrink-0">
            <AiBuilderPanel onApply={handleAiApply} />
          </div>
        )}
        {rightPanel === 'simulate' && (
          <div className="w-72 border-l overflow-hidden shrink-0">
            <SimulationPanel workflowId={id} />
          </div>
        )}
        {rightPanel === 'versions' && (
          <div className="w-72 border-l overflow-hidden shrink-0">
            <VersionSidebar workflowId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
