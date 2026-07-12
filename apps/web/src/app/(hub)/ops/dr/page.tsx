'use client';

import { useState } from 'react';
import { useDr, useTriggerBackup } from '@/hooks/use-ops';
import type { Backup, DrTest, DrConfig } from '@/types/ops';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const BACKUP_TYPE_BADGE: Record<string, string> = {
  full: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  incremental: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  snapshot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const TEST_STATUS_STYLES = {
  passed: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  in_progress: 'text-blue-600 dark:text-blue-400',
};

export default function DrPage() {
  const { data, isLoading } = useDr();
  const triggerBackup = useTriggerBackup();
  const [triggering, setTriggering] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'snapshot'>('incremental');

  const d = data as any;
  const config: DrConfig | null = d?.config ?? null;
  const backups: Backup[] = d?.backups ?? [];
  const tests: DrTest[] = d?.tests ?? [];

  const handleTrigger = async () => {
    setTriggering(true);
    await triggerBackup.mutateAsync(backupType);
    setTriggering(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Disaster Recovery</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Backup management, DR configuration, and recovery testing.
        </p>
      </div>

      {/* DR Config */}
      {config && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            DR Configuration
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-zinc-500">RTO Target</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                {config.rto} min
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">RPO Target</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                {config.rpo} min
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Primary Region</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                {config.primaryRegion}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Secondary Region</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                {config.secondaryRegion ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Backup Schedule</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                {config.backupSchedule}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Auto Backup</div>
              <div
                className={`mt-1 font-semibold ${config.autoBackup ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}
              >
                {config.autoBackup ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Cross-Region Replication</div>
              <div
                className={`mt-1 font-semibold ${config.crossRegionReplication ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}
              >
                {config.crossRegionReplication ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trigger backup */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Trigger Manual Backup
        </h2>
        <div className="flex gap-2">
          <select
            value={backupType}
            onChange={(e) => setBackupType(e.target.value as typeof backupType)}
            className="text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
          >
            <option value="incremental">Incremental</option>
            <option value="full">Full</option>
            <option value="snapshot">Snapshot</option>
          </select>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="text-sm px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {triggering ? 'Triggering…' : 'Trigger Backup'}
          </button>
        </div>
      </div>

      {/* Backup list */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Backups ({backups.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Size</th>
                  <th className="px-4 py-2 text-left">Region</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Started</th>
                  <th className="px-4 py-2 text-left">PITR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${BACKUP_TYPE_BADGE[b.type] ?? ''}`}
                      >
                        {b.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-zinc-600 dark:text-zinc-400">
                      {b.sizeBytes > 0 ? formatBytes(b.sizeBytes) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-500">{b.region}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          b.status === 'completed'
                            ? 'text-green-600 dark:text-green-400'
                            : b.status === 'running'
                              ? 'text-blue-600 dark:text-blue-400'
                              : b.status === 'failed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-zinc-400'
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(b.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {b.pitrEnabled ? (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DR Test history */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            DR Test History
          </h2>
        </div>
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {tests.map((t) => (
            <div key={t.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold capitalize text-zinc-700 dark:text-zinc-300">
                    {t.type}
                  </span>
                  <span className={`text-xs font-semibold ${TEST_STATUS_STYLES[t.status]}`}>
                    {t.status === 'passed'
                      ? '✓ Passed'
                      : t.status === 'failed'
                        ? '✗ Failed'
                        : '⟳ In Progress'}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(t.executedAt).toLocaleDateString()}
                </span>
              </div>
              {(t.rtoActual !== null || t.rpoActual !== null) && (
                <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                  {t.rtoActual !== null && (
                    <span>
                      RTO achieved: <strong>{t.rtoActual} min</strong>
                    </span>
                  )}
                  {t.rpoActual !== null && (
                    <span>
                      RPO achieved: <strong>{t.rpoActual} min</strong>
                    </span>
                  )}
                </div>
              )}
              {t.notes && <div className="mt-1 text-xs text-zinc-500">{t.notes}</div>}
            </div>
          ))}
          {tests.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No DR tests recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
