'use client';

import { useAuditEntries, useVerifyAuditChain } from '@/hooks/use-security';

export default function AuditPage() {
  const { data, isLoading } = useAuditEntries();
  const verify = useVerifyAuditChain();
  const entries = (data as any)?.entries ?? [];
  const verifyResult = verify.data as any;

  const handleVerify = () => verify.mutate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Immutable Audit Chain
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            SHA-256 hash-linked audit log — tamper-evident, SIEM-exportable.
          </p>
        </div>
        <button
          onClick={handleVerify}
          disabled={verify.isPending}
          className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {verify.isPending ? 'Verifying...' : 'Verify Chain'}
        </button>
      </div>

      {verifyResult && (
        <div
          className={`rounded-lg border p-4 ${verifyResult.valid ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'}`}
        >
          <div
            className={`text-sm font-semibold ${verifyResult.valid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
          >
            {verifyResult.valid
              ? `✓ Chain intact — ${verifyResult.total} entries verified`
              : `✗ Chain tampered at sequence ${verifyResult.invalidAt}`}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Events ({(data as any)?.total ?? 0})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-left font-medium">Actor</th>
                  <th className="px-4 py-2 text-left font-medium">Resource</th>
                  <th className="px-4 py-2 text-left font-medium">Hash</th>
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {entries.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-xs text-zinc-400 font-mono">{entry.sequence}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                        {entry.event.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {entry.event.actor}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">{entry.event.resource}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-400">
                      {entry.hash.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
