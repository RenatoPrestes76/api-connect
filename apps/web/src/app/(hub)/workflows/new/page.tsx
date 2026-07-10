'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitBranch, Sparkles, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateWorkflow } from '@/hooks/use-workflows';
import { usePlanWorkflow, useUseTemplate, useTemplates } from '@/hooks/use-workflow-builder';
import type { TriggerType } from '@/types/workflow';
import { cn } from '@/lib/utils';

type Tab = 'manual' | 'ai' | 'templates';

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  {
    value: 'EVENT',
    label: 'Event',
    description: 'Fires when a specific domain event occurs (e.g. product.updated)',
  },
  {
    value: 'WEBHOOK',
    label: 'Webhook',
    description: 'Triggered by an incoming HTTP webhook request',
  },
  {
    value: 'CRON',
    label: 'Cron',
    description: 'Runs on a recurring schedule (e.g. daily at 08:00)',
  },
  {
    value: 'MANUAL',
    label: 'Manual',
    description: 'Triggered manually via the API or the Run button',
  },
];

export default function NewWorkflowPage() {
  const router = useRouter();
  const create = useCreateWorkflow();
  const planMutation = usePlanWorkflow();
  const useTemplate = useUseTemplate();
  const { data: templates } = useTemplates();

  const [tab, setTab] = useState<Tab>('manual');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('EVENT');
  const [tags, setTagsRaw] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const wf = await create.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        triggerType,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success('Workflow created');
      router.push(`/workflows/${wf.id}/builder`);
    } catch {
      toast.error('Failed to create workflow');
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) {
      toast.error('Describe the workflow');
      return;
    }
    try {
      const { plan } = await planMutation.mutateAsync({ prompt: aiPrompt });
      const wf = await create.mutateAsync({
        name: plan.name,
        description: plan.description,
        triggerType: 'EVENT',
        tags: [],
        graph: plan.graph,
      });
      toast.success('AI Workflow created!');
      router.push(`/workflows/${wf.id}/builder`);
    } catch {
      toast.error('Failed to generate workflow');
    }
  };

  const handleUseTemplate = async (tplId: string) => {
    try {
      const wf = (await useTemplate.mutateAsync({ id: tplId })) as { id: string };
      toast.success('Template applied!');
      router.push(`/workflows/${wf.id}/builder`);
    } catch {
      toast.error('Failed to use template');
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/workflows"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">New Workflow</h1>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1 mb-6">
        {(
          [
            { key: 'manual', label: 'Manual', icon: GitBranch },
            { key: 'ai', label: 'AI Builder', icon: Sparkles },
            { key: 'templates', label: 'Templates', icon: LayoutTemplate },
          ] as { key: Tab; label: string; icon: React.ElementType }[]
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Manual tab */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-6">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Basic Information</h2>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ERP Product Sync"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Briefly describe what this workflow does…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Tags (comma-separated)
              </label>
              <input
                value={tags}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="erp, products, sync"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Trigger Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {TRIGGER_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setTriggerType(opt.value)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-colors',
                    triggerType === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-semibold mb-0.5',
                      triggerType === opt.value ? 'text-primary' : ''
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <GitBranch className="h-4 w-4" />
              {create.isPending ? 'Creating…' : 'Create & Open Builder'}
            </button>
            <Link
              href="/workflows"
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}

      {/* AI Builder tab */}
      {tab === 'ai' && (
        <form onSubmit={handleAiGenerate} className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              <h2 className="text-sm font-semibold">Descreva o Workflow</h2>
              <span className="ml-auto text-xs text-muted-foreground">Claude Opus 4.8</span>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={5}
              placeholder="Exemplo: Quero um fluxo que sincronize produtos do nosso ERP para o Mercado Livre a cada 15 minutos, validando estoque antes de publicar..."
              className="w-full rounded-lg border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500/40"
            />
            <p className="text-xs text-muted-foreground">
              A IA vai gerar automaticamente os nós, conexões e configurações com base na sua
              descrição.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={planMutation.isPending || create.isPending || !aiPrompt.trim()}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              {planMutation.isPending || create.isPending ? 'Gerando…' : 'Gerar com IA'}
            </button>
            <Link
              href="/workflows"
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {!templates ? (
            <p className="text-sm text-muted-foreground">Carregando templates…</p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tpl.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleUseTemplate(tpl.id)}
                  disabled={useTemplate.isPending}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Usar
                </button>
              </div>
            ))
          )}
          <Link
            href="/workflows/templates"
            className="block text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
          >
            Ver galeria completa →
          </Link>
        </div>
      )}
    </div>
  );
}
