'use client';
import { Zap } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'Por que o sync falhou?', prompt: 'Por que o sync de produtos ERP falhou?' },
  { label: 'Agentes sem heartbeat?', prompt: 'Quais agentes estão sem heartbeat agora?' },
  {
    label: 'Gerar mapeamento de clientes',
    prompt: 'Gere um mapeamento de entidade para clientes do ERP para Atlas',
  },
  {
    label: 'SQL para produtos atualizados hoje',
    prompt: 'Gere SQL para listar produtos atualizados hoje',
  },
  {
    label: 'Criar fluxo de sincronização de pedidos',
    prompt:
      'Crie um workflow: quando um pedido entra no ERP, sincronize para o Atlas e notifique o Slack',
  },
  { label: 'SLA breaches ativos', prompt: 'Existem violações de SLA ativas agora?' },
  { label: 'Status geral do sistema', prompt: 'Qual é o status atual do sistema Atlas Connect?' },
  {
    label: 'Explicar workflow de produtos',
    prompt: 'Explique como funciona o workflow ERP Product Sync',
  },
];

interface SuggestionsPanelProps {
  onSelect: (prompt: string) => void;
}

export function SuggestionsPanel({ onSelect }: SuggestionsPanelProps) {
  return (
    <div className="space-y-4 py-8">
      {/* Hero */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-600/30">
            <Zap className="h-7 w-7 text-indigo-500" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">Atlas Copilot</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Assistente de IA para diagnóstico, geração de configurações e monitoramento da plataforma.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSelect(s.prompt)}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/60" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
