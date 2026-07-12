'use client';
import type { AIInsight, TrafficForecast } from '@/types/helios';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bottleneck: { label: 'Bottleneck', color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  redundancy: {
    label: 'Redundancy',
    color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  growth_prediction: {
    label: 'Growth',
    color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  consolidation: {
    label: 'Consolidation',
    color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  },
  new_consumer: {
    label: 'New Consumer',
    color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
};

interface Props {
  insights: AIInsight[];
  forecasts: TrafficForecast[];
}

export function EventAI({ insights, forecasts }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">AI Insights</h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {insights.map((i) => {
            const meta = TYPE_LABELS[i.type];
            return (
              <div key={i.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {i.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200">{i.description}</p>
                    <p className="text-xs text-zinc-500 mt-1">→ {i.recommendation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Traffic Forecast</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Topic', 'Current EPS', '7d', '30d', '90d', 'Trend'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-zinc-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.topicId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-200 text-xs">{f.topicName}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">{f.currentEps}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">{f.forecast7d}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                    {f.forecast30d}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                    {f.forecast90d}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${f.trend === 'growing' ? 'text-emerald-400' : f.trend === 'declining' ? 'text-red-400' : 'text-zinc-400'}`}
                    >
                      {f.trend === 'growing' ? '↑' : f.trend === 'declining' ? '↓' : '→'} {f.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
