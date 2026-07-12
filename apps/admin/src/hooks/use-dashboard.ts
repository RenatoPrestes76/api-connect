import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/services/dashboard.service';

export function useDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 30_000,
  });
}
