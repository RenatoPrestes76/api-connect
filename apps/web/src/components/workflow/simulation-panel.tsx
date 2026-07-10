'use client';
import { useState } from 'react';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import type { SimulationResult, SimulationStep } from '@/types/workflow-builder';
import { useSimulateWorkflow } from '@/hooks/use-workflow-builder';

interface SimulationPanelProps {
  workflowId: string;
}

export function SimulationPanel({ workflowId }: SimulationPanelProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const simMutation = useSimulateWorkflow();

  const run = () => {
    simMutation.mutate(
      { id: workflowId },
      {
        onSuccess: (data) => {
          setResult(data);
          setExpandedIdx(null);
        },
      }
    );
  };

  const stepIcon = (step: SimulationStep) => {
    if (step.status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (step.status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-blue-500" />
        <h3 className="font-semibold text-sm">Simulação</h3>
      </div>

      <button
        onClick={run}
        disabled={simMutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {simMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Simulando...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Executar Dry-Run
          </>
        )}
      </button>

      {result && (
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              result.success
                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="font-medium">
              {result.success ? 'Simulação bem-sucedida' : 'Simulação com erros'}
            </span>
            <span className="ml-auto text-xs opacity-70">{result.totalMs}ms</span>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {result.warnings.length} aviso(s)
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-600 dark:text-yellow-500">
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {result.steps.length} etapas
            </p>
            {result.steps.map((step, idx) => (
              <div key={step.nodeId} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors"
                >
                  {stepIcon(step)}
                  <span className="flex-1 font-medium">{step.label}</span>
                  <span className="text-muted-foreground opacity-60">{step.durationMs}ms</span>
                  {expandedIdx === idx ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
                {expandedIdx === idx && (
                  <div className="border-t px-3 py-2 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Saída:</p>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                    {step.error && <p className="text-xs text-red-500 mt-1">Erro: {step.error}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
