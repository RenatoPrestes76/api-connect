'use client';
import type { SLADefinition } from '@/types/observatory';

interface Props {
  sla: SLADefinition;
}

export function SLAGauge({ sla }: Props) {
  const pct = sla.compliancePct;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 99 ? '#10b981' : pct >= 95 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums" style={{ color }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-center leading-tight">{sla.name}</span>
      <div className="flex gap-3 text-[10px] text-muted-foreground tabular-nums">
        <span>{sla.breachCount} breaches</span>
        <span>{sla.warnCount} warns</span>
      </div>
    </div>
  );
}
