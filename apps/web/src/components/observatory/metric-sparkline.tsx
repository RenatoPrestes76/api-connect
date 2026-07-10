'use client';
import type { MetricSample } from '@/types/observatory';

interface Props {
  data: MetricSample[];
  field: keyof MetricSample;
  color?: string;
  height?: number;
}

export function MetricSparkline({ data, field, color = '#6366f1', height = 40 }: Props) {
  if (!data.length) return null;
  const vals = data.map((d) => Number(d[field]));
  const min = Math.min(...vals);
  const max = Math.max(...vals) || 1;
  const w = 200;
  const h = height;
  const pts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const area = `M0,${h} L${pts
    .split(' ')
    .map((p) => `L${p}`)
    .join('')} L${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`sg-${field}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${field})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
