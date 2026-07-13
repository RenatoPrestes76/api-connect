'use client';
import { Plug, Clock, AlertCircle } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { StatusBadge } from '@/components/common/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ConnectorInstance } from '@/types/index';

interface ConnectorCardProps {
  connector: ConnectorInstance;
  onClick?: () => void;
}

export function ConnectorCard({ connector, onClick }: ConnectorCardProps) {
  return (
    <Card
      className={cn('transition-shadow', onClick ? 'cursor-pointer hover:shadow-md' : '')}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <Plug className="h-4 w-4 text-slate-500" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{connector.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {connector.driver} · {connector.database}
              </p>
            </div>
          </div>
          <StatusBadge status={connector.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {connector.lastSync ? formatRelative(connector.lastSync) : 'Never synced'}
          </span>
          {connector.errorCount > 0 && (
            <span className="flex items-center gap-1 text-rose-500">
              <AlertCircle className="h-3 w-3" />
              {connector.errorCount} error{connector.errorCount > 1 ? 's' : ''}
            </span>
          )}
          <span>v{connector.version}</span>
          <span>{connector.syncCount} syncs</span>
        </div>
      </CardContent>
    </Card>
  );
}
