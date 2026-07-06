'use client';
import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '@/services/health.service';
import { HEALTH_POLL_MS } from '@/lib/constants';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn:  ({ signal }) => getSystemHealth(signal),
    refetchInterval: HEALTH_POLL_MS,
  });
}
