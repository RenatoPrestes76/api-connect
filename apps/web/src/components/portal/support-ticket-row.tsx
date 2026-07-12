'use client';
import type { SupportTicket } from '@/types/portal';
import { cn } from '@/lib/utils';

const SEVERITY_COLOR: Record<string, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-yellow-500 text-slate-900',
  P4: 'bg-slate-500 text-white',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'text-blue-400',
  in_progress: 'text-yellow-400',
  resolved: 'text-green-400',
  closed: 'text-slate-500',
};

interface Props {
  ticket: SupportTicket;
  onStatusChange?: (id: string, status: SupportTicket['status']) => void;
}

export function SupportTicketRow({ ticket, onStatusChange }: Props) {
  return (
    <div className="flex items-center gap-3 rounded border border-slate-700 bg-slate-800/50 px-4 py-3">
      <span
        className={cn('rounded px-2 py-0.5 text-xs font-bold', SEVERITY_COLOR[ticket.severity])}
      >
        {ticket.severity}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">{ticket.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {ticket.category} · SLA: {ticket.slaTargetHours}h · #{ticket.id}
        </p>
      </div>
      <span className={cn('text-xs font-medium', STATUS_COLOR[ticket.status])}>
        {ticket.status.replace('_', ' ')}
      </span>
      {onStatusChange && ticket.status !== 'closed' && (
        <button
          onClick={() =>
            onStatusChange(ticket.id, ticket.status === 'open' ? 'in_progress' : 'resolved')
          }
          className="ml-2 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
        >
          {ticket.status === 'open' ? 'Iniciar' : 'Resolver'}
        </button>
      )}
    </div>
  );
}
