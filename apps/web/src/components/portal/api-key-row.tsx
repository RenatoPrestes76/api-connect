'use client';
import { KeyRound, Trash2, RefreshCw } from 'lucide-react';
import type { ApiKeyDTO } from '@/types/gateway';
import { cn } from '@/lib/utils';

interface Props {
  apiKey: ApiKeyDTO;
  environmentName?: string;
  onRevoke?: (id: string) => void;
  onRegenerate?: (id: string) => void;
}

export function ApiKeyRow({ apiKey, environmentName, onRevoke, onRegenerate }: Props) {
  const active = apiKey.status === 'active';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded border px-4 py-3',
        active ? 'border-slate-700 bg-slate-800/50' : 'border-slate-800 bg-slate-900/50 opacity-60'
      )}
    >
      <KeyRound className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-200">{apiKey.name}</p>
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
            {apiKey.role}
          </span>
          {!active && (
            <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-400">
              revogada
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-xs text-slate-500">
          {apiKey.publicId}
          {environmentName && (
            <span className="ml-2 font-sans not-italic">· {environmentName}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {apiKey.lastUsedAt
            ? `Último uso: ${new Date(apiKey.lastUsedAt).toLocaleString('pt-BR')}`
            : 'Nunca utilizada'}
        </p>
      </div>
      <div className="flex gap-1">
        {active && onRegenerate && (
          <button
            onClick={() => onRegenerate(apiKey.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-blue-900/30 hover:text-blue-400 transition-colors"
            title="Regenerar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        {active && onRevoke && (
          <button
            onClick={() => onRevoke(apiKey.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
            title="Revogar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
