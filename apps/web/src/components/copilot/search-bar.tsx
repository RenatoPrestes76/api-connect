'use client';
import { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { useSearch } from '@/hooks/use-copilot';
import type { SearchResult, EntityType } from '@/types/copilot';
import { cn } from '@/lib/utils';

const ENTITY_LABELS: Record<EntityType, string> = {
  connectors: 'Connector',
  workflows: 'Workflow',
  schemas: 'Schema',
  apis: 'API',
  agents: 'Agent',
  logs: 'Log',
  pipelines: 'Pipeline',
};

const ENTITY_COLORS: Record<EntityType, string> = {
  connectors: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  workflows: 'text-indigo-600  bg-indigo-500/10  border-indigo-500/20',
  schemas: 'text-amber-600   bg-amber-500/10   border-amber-500/20',
  apis: 'text-blue-600    bg-blue-500/10    border-blue-500/20',
  agents: 'text-violet-600  bg-violet-500/10  border-violet-500/20',
  logs: 'text-rose-600    bg-rose-500/10    border-rose-500/20',
  pipelines: 'text-cyan-600    bg-cyan-500/10    border-cyan-500/20',
};

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const { mutate: doSearch, isPending } = useSearch();

  const handleSearch = () => {
    if (!query.trim()) return;
    doSearch(
      { query: query.trim(), limit: 12 },
      {
        onSuccess: (data) => setResults(data.results),
      }
    );
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clear = () => {
    setQuery('');
    setResults(null);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full rounded-lg border border-border bg-background pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Busca semântica — connectors, workflows, schemas, logs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum resultado encontrado para &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-indigo-500/30 transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    ENTITY_COLORS[r.type] ?? 'text-muted-foreground bg-muted border-muted'
                  )}
                >
                  {ENTITY_LABELS[r.type] ?? r.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.description}</p>
                </div>
                <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                  {Math.round(r.relevance * 100)}%
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
