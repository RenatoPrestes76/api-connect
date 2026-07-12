import type { RiskEvent } from '@/types/security';
import { RiskBadge } from './risk-badge';

export function EventRow({ event }: { event: RiskEvent }) {
  const dt = new Date(event.detectedAt).toLocaleString();
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <td className="py-3 pr-4">
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          {event.description}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {event.actor} · {event.ip}
          {event.country ? ` · ${event.country}` : ''}
        </div>
      </td>
      <td className="py-3 pr-4">
        <RiskBadge level={event.level} />
      </td>
      <td className="py-3 pr-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${event.resolved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}
        >
          {event.resolved ? 'Resolved' : 'Active'}
        </span>
      </td>
      <td className="py-3 text-xs text-zinc-500 whitespace-nowrap">{dt}</td>
    </tr>
  );
}
