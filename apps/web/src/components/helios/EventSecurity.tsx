'use client';
import type { SecurityPolicy, SecurityAuditEntry } from '@/types/helios';

interface Props {
  policies: SecurityPolicy[];
  audit: SecurityAuditEntry[];
}

export function EventSecurity({ policies, audit }: Props) {
  const denied = audit.filter((a) => a.result === 'denied').length;
  const allowed = audit.filter((a) => a.result === 'allowed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">Allowed</p>
          <p className="text-2xl font-semibold text-emerald-400 tabular-nums">{allowed}</p>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">Denied</p>
          <p className="text-2xl font-semibold text-red-400 tabular-nums">{denied}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Security Policies</h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {policies.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.encryptionEnabled && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                      🔒 Encrypted
                    </span>
                  )}
                  {p.signatureRequired && (
                    <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                      ✍ Signed
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Topic: {p.topicId} · {p.allowedProducers.length} producers ·{' '}
                {p.allowedConsumers.length} consumers
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Recent Audit Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Time', 'Topic', 'Action', 'Actor', 'Result'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-zinc-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 8).map((a) => (
                <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-2 text-zinc-500">{a.timestamp.slice(11, 19)}</td>
                  <td className="px-4 py-2 text-zinc-400">{a.topicId}</td>
                  <td className="px-4 py-2 text-zinc-400">{a.action}</td>
                  <td className="px-4 py-2 text-zinc-300">{a.actor}</td>
                  <td className="px-4 py-2">
                    <span className={a.result === 'allowed' ? 'text-emerald-400' : 'text-red-400'}>
                      {a.result}
                    </span>
                    {a.reason && <span className="ml-1 text-zinc-600">({a.reason})</span>}
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
