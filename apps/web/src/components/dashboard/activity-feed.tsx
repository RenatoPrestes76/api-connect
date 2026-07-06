import { formatRelative } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { DashboardMetrics } from '@/types/index';

interface ActivityFeedProps {
  activities: DashboardMetrics['recentActivity'];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No recent activity</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activities.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                <span className="flex-1 truncate text-slate-700">{a.event}</span>
                {a.connector && (
                  <span className="shrink-0 font-mono text-xs text-slate-400">{a.connector}</span>
                )}
                <span className="shrink-0 text-xs text-slate-400">{formatRelative(a.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
