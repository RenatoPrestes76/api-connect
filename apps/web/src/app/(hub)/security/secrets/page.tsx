'use client';

import { useSecrets } from '@/hooks/use-security';
import { SecretRow } from '@/components/security/secret-row';

export default function SecretsPage() {
  const { data, isLoading } = useSecrets();
  const secrets = (data as any)?.secrets ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Secrets Management</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Envelope-encrypted secrets with provider abstraction.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Secrets <span className="text-zinc-400 font-normal ml-1">({secrets.length})</span>
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Value</th>
                  <th className="px-4 py-2 text-left font-medium">Provider</th>
                  <th className="px-4 py-2 text-left font-medium">Version · Rotated</th>
                  <th className="px-4 py-2 text-left font-medium">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {secrets.map((s: any) => (
                  <SecretRow key={s.id} secret={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
