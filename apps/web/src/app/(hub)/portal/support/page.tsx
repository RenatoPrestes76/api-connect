'use client';
import { useState } from 'react';
import { useSupportTickets, useCreateTicket, useUpdateTicketStatus } from '@/hooks/use-portal';
import { SupportTicketRow } from '@/components/portal/support-ticket-row';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { SupportStatus } from '@/types/portal';

const STATUS_TABS: { value: SupportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abertos' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'closed', label: 'Fechados' },
];

export default function SupportPage() {
  const [tab, setTab] = useState<SupportStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'P3',
    category: 'technical',
  });

  const { data, isLoading, error } = useSupportTickets(tab !== 'all' ? { status: tab } : {});
  const createTicket = useCreateTicket();
  const updateStatus = useUpdateTicketStatus();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar tickets" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Suporte</h1>
          <p className="text-sm text-slate-400">{data?.total ?? 0} tickets</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Novo Ticket
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">Novo Ticket de Suporte</h3>
          <input
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-slate-700"
            placeholder="Título"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 border border-slate-700 resize-none"
            placeholder="Descrição"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {['P1', 'P2', 'P3', 'P4'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {['billing', 'technical', 'security', 'integration', 'other'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                createTicket.mutate(form as any, { onSuccess: () => setShowForm(false) });
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Criar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(data?.tickets ?? []).map((ticket) => (
          <SupportTicketRow
            key={ticket.id}
            ticket={ticket}
            onStatusChange={(id, status) => {
              const next = status === 'open' ? 'in_progress' : 'resolved';
              updateStatus.mutate({ id, status: next });
            }}
          />
        ))}
        {data?.tickets.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhum ticket encontrado</p>
        )}
      </div>
    </div>
  );
}
