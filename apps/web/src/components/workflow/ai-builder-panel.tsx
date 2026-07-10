'use client';
import { useState } from 'react';
import { Sparkles, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import type { WorkflowPlan } from '@/types/workflow-builder';
import type { WorkflowGraph } from '@/types/workflow';
import { usePlanWorkflow } from '@/hooks/use-workflow-builder';

interface AiBuilderPanelProps {
  onApply: (graph: WorkflowGraph, name: string, description: string) => void;
}

const SUGGESTIONS = [
  'Sincronizar produtos do ERP para o e-commerce a cada 5 minutos',
  'Processar novos pedidos: validar, reservar estoque e emitir NF-e',
  'Onboarding de novo cliente com classificação por IA e e-mail personalizado',
  'Pipeline ETL noturno do ERP para o data warehouse de BI',
  'Atualizar preços dinamicamente com análise de concorrência por IA',
];

export function AiBuilderPanel({ onApply }: AiBuilderPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);
  const [model, setModel] = useState('');
  const planMutation = usePlanWorkflow();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    planMutation.mutate(
      { prompt },
      {
        onSuccess: (data) => {
          setPlan(data.plan);
          setModel(data.model);
        },
      }
    );
  };

  const handleApply = () => {
    if (!plan) return;
    onApply(plan.graph, plan.name, plan.description);
    setPlan(null);
    setPrompt('');
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-green-500" />
        <h3 className="font-semibold">AI Builder</h3>
        <span className="text-xs text-muted-foreground ml-auto">Claude Opus 4.8</span>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Descreva o fluxo de integração que você quer criar..."
          className="w-full min-h-[100px] resize-none rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || planMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {planMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar Workflow
            </>
          )}
        </button>
      </div>

      {!plan && !planMutation.isPending && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-medium">Sugestões:</p>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setPrompt(s)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}

      {planMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Falha ao gerar o workflow. Tente novamente.
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{plan.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/50 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
              {Math.round(plan.confidence * 100)}% conf.
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{plan.graph.nodes.length} nós</span>
            <span>·</span>
            <span>{plan.graph.edges.length} conexões</span>
            <span>·</span>
            <span className="text-green-600 dark:text-green-400">{model}</span>
          </div>

          {plan.reasoning && (
            <p className="text-xs text-muted-foreground border-t pt-2">{plan.reasoning}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              Aplicar no Canvas
            </button>
            <button
              onClick={() => {
                setPlan(null);
              }}
              className="rounded-lg border px-3 py-2 text-xs hover:bg-muted transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
