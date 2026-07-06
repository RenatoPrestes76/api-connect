'use client';
import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '@/services/dashboard.service';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn:  ({ signal }) => getDashboardMetrics(signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
