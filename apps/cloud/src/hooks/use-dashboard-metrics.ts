'use client';
import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '../services/atlas-api';
import { POLL_INTERVAL_MS } from '../lib/constants';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: getDashboardMetrics,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 10_000,
  });
}
