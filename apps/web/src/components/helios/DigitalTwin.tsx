'use client';
import type { TwinNode, TwinEdge, TwinFlow } from '@/types/helios';

const NODE_COLORS: Record<string, string> = {
  erp: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  workflow: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  connector: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
  wms: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  tms: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  ai_engine: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  analytics: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  customer: 'bg-pink-500/15 border-pink-500/30 text-pink-300',
  external: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-300',
};

interface Props {
  nodes: TwinNode[];
  edges: TwinEdge[];
  flow?: TwinFlow | null;
}

export function DigitalTwin({ nodes, edges, flow }: Props) {
  return (
    <div className="space-y-4">
      {/* Node Grid */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Live Node Status</h3>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {nodes.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 ${NODE_COLORS[n.type] ?? 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${n.status === 'active' ? 'bg-emerald-400' : n.status === 'error' ? 'bg-red-400' : 'bg-zinc-500'}`}
                />
                <span className="text-xs font-medium truncate">{n.name}</span>
              </div>
              <p className="text-xs opacity-60">{n.eventsLast24h.toLocaleString()} events/24h</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edges */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Event Flow Paths</h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {edges.slice(0, 6).map((e, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-2 text-xs">
              <span className="text-zinc-400">{e.from.replace('node-', '')}</span>
              <span className="text-zinc-600">→</span>
              <span className="text-zinc-400">{e.to.replace('node-', '')}</span>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-zinc-500 font-mono">{e.eventType}</span>
              <span className="ml-auto text-zinc-600">{e.latencyMs}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Order Flow */}
      {flow && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Order Flow: {flow.orderId}</h3>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs ${flow.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : flow.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
            >
              {flow.status}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {flow.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'pending' ? 'bg-zinc-700 text-zinc-500' : 'bg-red-500/20 text-red-400'}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-200">{s.nodeName}</span>
                  <span className="mx-2 text-zinc-600">·</span>
                  <span className="text-zinc-500 text-xs">{s.eventType}</span>
                </div>
                {s.durationMs > 0 && (
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                    {s.durationMs}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
