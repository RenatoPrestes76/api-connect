import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getDashboardSummary, type DashboardData } from '@/services/dashboard.service';

export function useDashboard(): UseQueryResult<DashboardData> {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 30_000,
  });
}
