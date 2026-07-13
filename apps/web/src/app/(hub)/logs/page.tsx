'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { LogViewer } from '@/components/logs/log-viewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogs } from '@/hooks/use-logs';
import { exportLogs } from '@/services/logs.service';
import type { LogLevel } from '@/types/index';

const LEVELS: Array<{ label: string; value: LogLevel | '' }> = [
  { label: 'All levels', value: '' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
  { label: 'Fatal', value: 'fatal' },
];

export default function LogsPage() {
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [connector, setConnector] = useState('');
  const [live, setLive] = useState(true);
  const [search, setSearch] = useState('');

  const query = {
    level: level || undefined,
    connector: connector || undefined,
    search: search || undefined,
    limit: 500,
  };

  const { data, isLoading, error, refetch } = useLogs(query, live);
  const entries = data?.data ?? [];

  const handleExport = async () => {
    const blob = await exportLogs(query);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Logs"
        description={`${entries.length} entries`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive(!live)}
              className={[
                'rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors',
                live
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {live ? 'Live' : 'Paused'}
            </button>
            <Button size="sm" variant="outline" onClick={() => void handleExport()}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as LogLevel | '')}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="Filter by connector…"
          value={connector}
          onChange={(e) => setConnector(e.target.value)}
          className="w-44"
        />
        <Input
          placeholder="Search messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      {isLoading ? (
        <PageLoading />
      ) : error ? (
        <ErrorState message="Could not load logs." onRetry={() => void refetch()} />
      ) : (
        <LogViewer
          entries={entries}
          autoScroll={live}
          maxHeight="calc(100vh - 280px)"
          onExport={() => void handleExport()}
        />
      )}
    </div>
  );
}
