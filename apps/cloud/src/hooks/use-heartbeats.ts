'use client';
import { useQuery } from '@tanstack/react-query';
import { getDashboardActivity } from '../services/atlas-api';
import { POLL_INTERVAL_MS } from '../lib/constants';

export function useActivity(sinceMs = 3_600_000) {
  return useQuery({
    queryKey: ['dashboard', 'activity', sinceMs],
    queryFn: () => getDashboardActivity(sinceMs),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 10_000,
  });
}
