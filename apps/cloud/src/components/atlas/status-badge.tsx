import { cn } from '../../lib/utils.js';
import { STATUS_COLORS } from '../../lib/constants.js';
import type { AgentHealthStatus, AgentDomainStatus } from '../../types/atlas.js';

type StatusKey = AgentHealthStatus | AgentDomainStatus;

interface StatusBadgeProps {
  status:    StatusKey;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.OFFLINE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
        colors.bg, colors.text, className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {status}
    </span>
  );
}
