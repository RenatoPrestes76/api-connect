'use client';

interface UsageMeterProps {
  label: string;
  value: number;
  limit: number | null;
  unit?: string;
}

function pct(value: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0;
  return Math.min(100, Math.round((value / limit) * 100));
}

function barColor(p: number): string {
  if (p >= 90) return 'bg-rose-500';
  if (p >= 70) return 'bg-amber-500';
  return 'bg-indigo-500';
}

export function UsageMeter({ label, value, limit, unit = '' }: UsageMeterProps) {
  const p = pct(value, limit);
  const isUnlimited = limit === null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-mono text-xs">
          {value.toLocaleString()}
          {unit} {isUnlimited ? '' : `/ ${limit!.toLocaleString()}${unit}`}
          {isUnlimited && <span className="text-emerald-400 ml-1">unlimited</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-slate-800">
          <div
            className={`h-1.5 rounded-full transition-all ${barColor(p)}`}
            style={{ width: `${p}%` }}
          />
        </div>
      )}
    </div>
  );
}
