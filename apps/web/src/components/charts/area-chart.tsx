'use client';
import {
  AreaChart as ReAreaChart,
  Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AreaChartProps {
  data:     Record<string, unknown>[];
  xKey:     string;
  series:   Array<{ key: string; color: string; label: string }>;
  height?:  number;
  compact?: boolean;
}

export function AreaChart({ data, xKey, series, height = 200, compact = false }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: compact ? -20 : 0 }}>
        {!compact && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        )}
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          hide={compact}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          }}
          labelStyle={{ color: '#475569', fontWeight: 600 }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.08}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
