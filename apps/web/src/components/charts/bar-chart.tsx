'use client';
import {
  BarChart as ReBarChart,
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface BarChartProps {
  data:     Record<string, unknown>[];
  xKey:     string;
  yKey:     string;
  color?:   string;
  height?:  number;
  label?:   string;
}

export function BarChart({
  data, xKey, yKey, color = '#4f46e5', height = 180, label,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
          }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Bar dataKey={yKey} name={label ?? yKey} fill={color} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.85} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
