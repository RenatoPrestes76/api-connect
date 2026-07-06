'use client';
import { AreaChart } from '@/components/charts/area-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { DashboardMetrics } from '@/types/index';

interface SyncChartProps {
  trend: DashboardMetrics['syncTrend'];
}

export function SyncChart({ trend }: SyncChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Activity (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <AreaChart
          data={trend.map((t) => ({ ...t, label: new Date(t.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) }))}
          xKey="label"
          series={[
            { key: 'count',  color: '#4f46e5', label: 'Syncs'    },
            { key: 'failed', color: '#f43f5e', label: 'Failed'   },
          ]}
          height={160}
        />
      </CardContent>
    </Card>
  );
}
