'use client';

import { useState } from 'react';
import type { BackupRecord, BackupType } from '@/types/ha';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

const TYPE_BADGE: Record<BackupType, string> = {
  full: 'text-indigo-600 dark:text-indigo-400',
  incremental: 'text-sky-600 dark:text-sky-400',
  snapshot: 'text-violet-600 dark:text-violet-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

interface Props {
  backups: BackupRecord[];
  totalSizeBytes: number;
  onCreateBackup?: (tenantId: string, type: BackupType) => void;
  onRestore?: (backupId: string, tenantId: string) => void;
  isPending?: boolean;
}

const TENANTS = ['tenant-enterprise', 'tenant-professional', 'tenant-community'];
const TYPES: BackupType[] = ['full', 'incremental', 'snapshot'];

export function BackupManager({
  backups,
  totalSizeBytes,
  onCreateBackup,
  onRestore,
  isPending,
}: Props) {
  const [selectedTenant, setSelectedTenant] = useState(TENANTS[0]!);
  const [selectedType, setSelectedType] = useState<BackupType>('full');

  const totalGB = (totalSizeBytes / 1e9).toFixed(1);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Backup Manager</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {backups.length} backups · {totalGB} GB total
          </p>
        </div>
        {onCreateBackup && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {TENANTS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('tenant-', '')}
                </option>
              ))}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as BackupType)}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => onCreateBackup(selectedTenant, selectedType)}
              disabled={isPending}
              className="text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
            >
              Backup Now
            </button>
          </div>
        )}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[320px] overflow-y-auto">
        {backups.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${TYPE_BADGE[b.type]}`}>{b.type}</span>
                <span className="text-xs text-zinc-400">{b.tenantId.replace('tenant-', '')}</span>
                <span className="text-xs text-zinc-400">{timeAgo(b.createdAt)}</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono truncate">{b.checksum.slice(0, 24)}…</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-zinc-500 tabular-nums">{b.sizeLabel}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status]}`}
              >
                {b.status}
              </span>
              {onRestore && b.status === 'completed' && (
                <button
                  onClick={() => onRestore(b.id, b.tenantId)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
