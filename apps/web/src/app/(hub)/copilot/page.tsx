'use client';
import { useState } from 'react';
import {
  Bot,
  MessageSquare,
  Stethoscope,
  Wand2,
  BookOpen,
  Search as SearchIcon,
  ClipboardList,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ChatPanel } from '@/components/copilot/chat-panel';
import { SearchBar } from '@/components/copilot/search-bar';
import {
  useConversations,
  useDeleteConversation,
  useDiagnose,
  useGenerate,
  useExplain,
} from '@/hooks/use-copilot';
import { useCopilotAudit } from '@/hooks/use-copilot';
import { cn } from '@/lib/utils';
import type {
  DiagnoseResponse,
  GenerateResponse,
  ExplainResponse,
  GenerateType,
  ExplainType,
} from '@/types/copilot';

type Tab = 'chat' | 'diagnose' | 'generate' | 'explain' | 'search' | 'audit';

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'diagnose', label: 'Diagnóstico', icon: Stethoscope },
  { id: 'generate', label: 'Gerar', icon: Wand2 },
  { id: 'explain', label: 'Explicar', icon: BookOpen },
  { id: 'search', label: 'Busca', icon: SearchIcon },
  { id: 'audit', label: 'Auditoria', icon: ClipboardList },
];

// ─── Diagnose Tab ─────────────────────────────────────────────────────────────

function DiagnoseTab() {
  const [question, setQuestion] = useState('');
  const { mutate, isPending, data, isError } = useDiagnose();

  const result = data as DiagnoseResponse | undefined;

  const SEVERITY_COLOR: Record<string, string> = {
    critical: 'text-red-600 bg-red-500/10 border-red-500/30',
    high: 'text-orange-600 bg-orange-500/10 border-orange-500/30',
    medium: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
    low: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Qual problema você quer diagnosticar?</label>
        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Por que o sync de produtos falhou? Quais agentes estão offline? Há breach de SLA ativo?"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      <button
        onClick={() => mutate({ question })}
        disabled={!question.trim() || isPending}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Stethoscope className="h-4 w-4" />
        )}
        Diagnosticar
      </button>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao realizar diagnóstico. Tente novamente.
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div>
              <p className="font-semibold">{result.diagnosis}</p>
              {result.rootCause && (
                <p className="text-sm text-muted-foreground mt-1">{result.rootCause}</p>
              )}
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase',
                SEVERITY_COLOR[result.severity] ?? ''
              )}
            >
              {result.severity}
            </span>
          </div>

          {/* Steps */}
          {result.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ações recomendadas
              </p>
              {result.suggestions.map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-3 rounded-lg bg-background border border-border p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    {s.command && (
                      <code className="mt-1 block text-[11px] bg-slate-800 text-amber-300 rounded px-2 py-1 font-mono">
                        {s.command}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.relatedResources && result.relatedResources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.relatedResources.map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const [genType, setGenType] = useState<GenerateType>('mapping');
  const [desc, setDesc] = useState('');
  const { mutate, isPending, data, isError } = useGenerate();

  const result = data as GenerateResponse | undefined;

  const TYPE_OPTIONS: Array<{ value: GenerateType; label: string }> = [
    { value: 'mapping', label: 'Entity Mapping' },
    { value: 'sql', label: 'SQL Query' },
    { value: 'flow', label: 'Workflow Pipeline' },
  ];

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setGenType(o.value)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              genType === o.value
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                : 'border-border text-muted-foreground hover:border-indigo-500/30 hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descreva o que deseja gerar</label>
        <textarea
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={
            genType === 'mapping'
              ? 'Ex: Mapeamento de clientes ERP para Atlas Customer com CPF/CNPJ'
              : genType === 'sql'
                ? 'Ex: Listar produtos atualizados hoje com o nome do connector'
                : 'Ex: Quando um pedido entra no ERP, sincronize para o Atlas e notifique o Slack'
          }
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      <button
        onClick={() => mutate({ type: genType, description: desc })}
        disabled={!desc.trim() || isPending}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        Gerar
      </button>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao gerar. Tente novamente.
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <p className="font-semibold text-sm">{result.title}</p>
            <p className="text-xs text-muted-foreground">{result.description}</p>
          </div>
          {result.code && (
            <div>
              <div className="bg-slate-700 text-slate-300 text-[10px] px-3 py-1 font-mono">
                {result.language ?? 'json'}
              </div>
              <pre className="bg-slate-800 text-slate-100 text-xs p-4 overflow-x-auto leading-relaxed whitespace-pre max-h-96">
                <code>{result.code}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Explain Tab ──────────────────────────────────────────────────────────────

function ExplainTab() {
  const [explainType, setExplainType] = useState<ExplainType>('workflow');
  const [desc, setDesc] = useState('');
  const { mutate, isPending, data, isError } = useExplain();

  const result = data as ExplainResponse | undefined;

  const TYPE_OPTIONS: Array<{ value: ExplainType; label: string }> = [
    { value: 'mapping', label: 'Mapping' },
    { value: 'workflow', label: 'Workflow' },
    { value: 'pipeline', label: 'Pipeline' },
    { value: 'query', label: 'SQL Query' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setExplainType(o.value)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              explainType === o.value
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                : 'border-border text-muted-foreground hover:border-indigo-500/30 hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">O que deseja explicar?</label>
        <textarea
          rows={4}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={`Cole o JSON ou ID do ${explainType} aqui, ou descreva brevemente.`}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-xs"
        />
      </div>
      <button
        onClick={() => mutate({ type: explainType, description: desc })}
        disabled={!desc.trim() || isPending}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BookOpen className="h-4 w-4" />
        )}
        Explicar
      </button>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao explicar. Tente novamente.
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">{result.summary}</p>
          <div className="prose-sm text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {result.explanation}
          </div>
          {result.components && result.components.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Componentes
              </p>
              {result.components.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
                  <span>
                    <span className="font-medium">{c.name}</span> — {c.description}
                  </span>
                </div>
              ))}
            </div>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
              {result.warnings.join(' • ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  chat: 'text-indigo-600 bg-indigo-500/10',
  diagnose: 'text-rose-600   bg-rose-500/10',
  generate: 'text-emerald-600 bg-emerald-500/10',
  explain: 'text-amber-600  bg-amber-500/10',
  search: 'text-blue-600   bg-blue-500/10',
};

function AuditTab() {
  const { data, isLoading } = useCopilotAudit({ limit: 30 });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const items = data?.items ?? [];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {data?.total ?? 0} entradas de auditoria de IA
      </p>
      {items.map((log) => (
        <div key={log.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                ACTION_COLOR[log.action] ?? ''
              )}
            >
              {log.action}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleString('pt-BR')}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {log.modelUsed}
            </span>
            {log.durationMs && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {log.durationMs}ms
              </span>
            )}
          </div>
          <p className="text-sm font-medium truncate">{log.prompt}</p>
          <p className="text-xs text-muted-foreground truncate">{log.responsePreview}</p>
        </div>
      ))}
    </div>
  );
}

// ─── History sidebar ─────────────────────────────────────────────────────────

function ConversationSidebar({
  activeId,
  onSelect,
}: {
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const { data } = useConversations();
  const items = data?.items ?? [];

  if (items.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Histórico
      </p>
      {items.slice(0, 8).map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
            conv.id === activeId
              ? 'bg-indigo-500/10 text-indigo-600'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <p className="text-xs font-medium truncate">{conv.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{conv.messageCount} msgs</p>
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CopilotPage() {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="flex h-full flex-col space-y-0 -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-4 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/30">
          <Bot className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Atlas Copilot</h1>
          <p className="text-xs text-muted-foreground">
            Assistente de IA — diagnóstico, geração e busca semântica
          </p>
        </div>

        {/* Tab pills */}
        <nav className="ml-auto flex items-center gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                tab === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {tab === 'chat' ? (
          /* Chat has its own full-height layout */
          <ChatPanel className="flex-1 min-h-0" />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'diagnose' && <DiagnoseTab />}
            {tab === 'generate' && <GenerateTab />}
            {tab === 'explain' && <ExplainTab />}
            {tab === 'search' && <SearchBar />}
            {tab === 'audit' && <AuditTab />}
          </div>
        )}
      </div>
    </div>
  );
}
