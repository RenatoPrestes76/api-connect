'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { TemplateCard } from '@/components/workflow/template-card';
import { useTemplates } from '@/hooks/use-workflow-builder';

const CATEGORIES = [
  'Todos',
  'Integração ERP',
  'Analytics',
  'CRM',
  'Pedidos',
  'Estoque',
  'Precificação',
];

export default function TemplatesPage() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data: templates, isLoading, isError } = useTemplates(category);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Templates de Workflow"
        description="Comece rapidamente com templates de integração pré-construídos e personalize conforme sua necessidade."
      />

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat === 'Todos' ? undefined : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (cat === 'Todos' && !category) || cat === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-6 text-center text-sm text-red-600 dark:text-red-400">
          Falha ao carregar templates. Verifique a conexão com a API.
        </div>
      )}

      {templates && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} />
          ))}
        </div>
      )}

      {templates?.length === 0 && (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Nenhum template encontrado para essa categoria.
        </div>
      )}
    </div>
  );
}
