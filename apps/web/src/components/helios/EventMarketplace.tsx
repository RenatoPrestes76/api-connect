'use client';
import type { MarketplaceEvent } from '@/types/helios';

const CATEGORY_COLORS: Record<string, string> = {
  commerce: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  fiscal: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  logistics: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  finance: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  crm: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  catalog: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  security: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

interface Props {
  events: MarketplaceEvent[];
}

export function EventMarketplace({ events }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {events.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-semibold text-zinc-200">{e.eventType}</p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs shrink-0 ${CATEGORY_COLORS[e.category] ?? 'bg-zinc-700 text-zinc-300'}`}
            >
              {e.category}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">{e.description}</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-500">by {e.producer}</span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-indigo-400">{e.version}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{e.subscriberCount} subscribers</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {e.tags.map((t) => (
              <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
