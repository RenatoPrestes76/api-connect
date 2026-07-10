'use client';
import { CheckCircle, Download, Shield, RefreshCw } from 'lucide-react';
import type { MarketplaceConnector } from '@/types/marketplace';
import { ReviewStars } from './review-stars';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  ERP: 'bg-blue-900/40 text-blue-300 border-blue-800',
  CRM: 'bg-violet-900/40 text-violet-300 border-violet-800',
  'E-commerce': 'bg-pink-900/40 text-pink-300 border-pink-800',
  Marketplace: 'bg-orange-900/40 text-orange-300 border-orange-800',
  WMS: 'bg-teal-900/40 text-teal-300 border-teal-800',
  'Banco de dados': 'bg-green-900/40 text-green-300 border-green-800',
  'APIs REST': 'bg-sky-900/40 text-sky-300 border-sky-800',
  GraphQL: 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800',
  Mensageria: 'bg-amber-900/40 text-amber-300 border-amber-800',
  'Armazenamento em nuvem': 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
};

interface ConnectorCardProps {
  connector: MarketplaceConnector;
  onInstall?: (id: string) => void;
  onUninstall?: (installationId: string) => void;
  onUpdate?: (installationId: string) => void;
  loading?: boolean;
}

export function ConnectorCard({
  connector,
  onInstall,
  onUninstall,
  onUpdate,
  loading,
}: ConnectorCardProps) {
  const {
    manifest,
    status,
    downloads,
    rating,
    featured,
    verified,
    installedVersion,
    installationId,
  } = connector;
  const catColor =
    CATEGORY_COLORS[manifest.category] ?? 'bg-slate-800 text-slate-300 border-slate-700';
  const isInstalled = status === 'installed' || status === 'update-available';
  const hasUpdate = status === 'update-available';

  return (
    <div
      className={cn(
        'rounded-lg border bg-slate-900 p-4 flex flex-col gap-3 transition-colors',
        featured ? 'border-indigo-700/60' : 'border-slate-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-semibold text-white truncate">{manifest.name}</span>
            {verified && (
              <Shield className="h-3.5 w-3.5 shrink-0 text-green-400" aria-label="verificado" />
            )}
            {featured && <span className="text-[10px] font-bold text-amber-400">★ DESTAQUE</span>}
          </div>
          <p className="text-[11px] text-slate-500">
            por {manifest.author} · v{manifest.version}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            catColor
          )}
        >
          {manifest.category}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 line-clamp-2">{manifest.description}</p>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <ReviewStars rating={rating} />
          {rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {downloads.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Keywords */}
      {manifest.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {manifest.keywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      <div className="mt-auto pt-2 border-t border-slate-800 flex items-center gap-2">
        {!isInstalled && (
          <button
            onClick={() => onInstall?.(manifest.id)}
            disabled={loading}
            className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Instalando…' : 'Instalar'}
          </button>
        )}
        {isInstalled && !hasUpdate && (
          <>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3.5 w-3.5" /> Instalado v{installedVersion}
            </span>
            <button
              onClick={() => installationId && onUninstall?.(installationId)}
              disabled={loading}
              className="ml-auto text-[11px] text-slate-500 hover:text-red-400 transition-colors"
            >
              Remover
            </button>
          </>
        )}
        {hasUpdate && (
          <>
            <button
              onClick={() => installationId && onUpdate?.(installationId)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {loading ? 'Atualizando…' : `Atualizar → v${manifest.version}`}
            </button>
            <button
              onClick={() => installationId && onUninstall?.(installationId)}
              disabled={loading}
              className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
            >
              Remover
            </button>
          </>
        )}
      </div>
    </div>
  );
}
