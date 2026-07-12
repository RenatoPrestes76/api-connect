'use client';
import { KeyRound, Trash2, Ban } from 'lucide-react';
import type { ApiKey } from '@/types/portal';
import { cn } from '@/lib/utils';

interface Props {
  apiKey: ApiKey;
  onRevoke?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ApiKeyRow({ apiKey, onRevoke, onDelete }: Props) {
  const isExpired = apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded border px-4 py-3',
        apiKey.active && !isExpired
          ? 'border-slate-700 bg-slate-800/50'
          : 'border-slate-800 bg-slate-900/50 opacity-60'
      )}
    >
      <KeyRound className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-200">{apiKey.name}</p>
          {!apiKey.active && (
            <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-400">
              revogada
            </span>
          )}
          {isExpired && apiKey.active && (
            <span className="rounded bg-orange-900/40 px-1.5 py-0.5 text-xs text-orange-400">
              expirada
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-xs text-slate-500">
          {apiKey.prefix}••••••••
          {apiKey.expiresAt && (
            <span className="ml-2 not-italic">
              exp. {new Date(apiKey.expiresAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">{apiKey.scopes.join(', ')}</p>
      </div>
      <div className="flex gap-1">
        {apiKey.active && !isExpired && onRevoke && (
          <button
            onClick={() => onRevoke(apiKey.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-orange-900/30 hover:text-orange-400 transition-colors"
            title="Revogar"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(apiKey.id)}
            className="rounded p-1.5 text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
