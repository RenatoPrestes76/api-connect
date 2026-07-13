'use client';
import { useQuery } from '@tanstack/react-query';
import { getAgent } from '../services/atlas-api';
import { POLL_INTERVAL_MS } from '../lib/constants';

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => getAgent(id),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 10_000,
    enabled: !!id,
  });
}
