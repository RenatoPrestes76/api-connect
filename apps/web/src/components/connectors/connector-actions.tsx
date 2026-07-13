'use client';
import { useState } from 'react';
import { Play, Square, RotateCcw, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startConnector, stopConnector, restartConnector } from '@/services/connectors.service';
import type { ConnectorInstance } from '@/types/index';

interface ConnectorActionsProps {
  connector: ConnectorInstance;
  onRefresh?: () => void;
  onViewLogs?: (id: string) => void;
  compact?: boolean;
}

export function ConnectorActions({
  connector,
  onRefresh,
  onViewLogs,
  compact = false,
}: ConnectorActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: string, fn: () => Promise<void>) => {
    setBusy(action);
    try {
      await fn();
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const isRunning = connector.status === 'RUNNING';
  const isStopped = connector.status === 'STOPPED' || connector.status === 'ERROR';
  const isTransient = connector.status === 'STARTING' || connector.status === 'STOPPING';

  return (
    <div className="flex items-center gap-1.5">
      {(isStopped || connector.status === 'ERROR') && (
        <Button
          size={compact ? 'sm' : 'sm'}
          variant="success"
          loading={busy === 'start'}
          disabled={isTransient || !!busy}
          onClick={() => void run('start', () => startConnector(connector.id))}
        >
          <Play className="h-3 w-3" />
          {!compact && 'Start'}
        </Button>
      )}
      {isRunning && (
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'stop'}
          disabled={isTransient || !!busy}
          onClick={() => void run('stop', () => stopConnector(connector.id))}
        >
          <Square className="h-3 w-3" />
          {!compact && 'Stop'}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        loading={busy === 'restart'}
        disabled={isTransient || !!busy}
        onClick={() => void run('restart', () => restartConnector(connector.id))}
      >
        <RotateCcw className="h-3 w-3" />
        {!compact && 'Restart'}
      </Button>
      {onRefresh && (
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={!!busy}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
      {onViewLogs && (
        <Button size="sm" variant="ghost" onClick={() => onViewLogs(connector.id)}>
          <FileText className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
