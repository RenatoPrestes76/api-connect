'use client';
import { Loader2, Zap } from 'lucide-react';
import type { WorkflowTemplate } from '@/types/workflow-builder';
import { useUseTemplate } from '@/hooks/use-workflow-builder';
import { useRouter } from 'next/navigation';

interface TemplateCardProps {
  template: WorkflowTemplate;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Integração ERP': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Analytics: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  CRM: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Pedidos: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Estoque: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Precificação: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const useIt = useUseTemplate();

  const handleUse = () => {
    useIt.mutate(
      { id: template.id, name: template.name, description: template.description },
      { onSuccess: (wf: { id: string }) => router.push(`/workflows/${wf.id}/builder`) }
    );
  };

  const catColor =
    CATEGORY_COLORS[template.category] ??
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  const nodeCount = template.graph.nodes.length;
  const aiNodes = template.graph.nodes.filter((n) => n.type.startsWith('ai-')).length;

  return (
    <div className="group rounded-xl border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-tight">{template.name}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${catColor}`}>
          {template.category}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{nodeCount} nós</span>
        {aiNodes > 0 && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Zap className="h-3 w-3" />
              {aiNodes} IA
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {template.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            #{tag}
          </span>
        ))}
      </div>

      <button
        onClick={handleUse}
        disabled={useIt.isPending}
        className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {useIt.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        Usar Template
      </button>
    </div>
  );
}
