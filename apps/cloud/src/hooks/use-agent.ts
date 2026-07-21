'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getAgent } from '../services/atlas-api';
import { POLL_INTERVAL_MS } from '../lib/constants';

export function useAgent(id: string): UseQueryResult<Awaited<ReturnType<typeof getAgent>>> {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => getAgent(id),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 10_000,
    enabled: !!id,
  });
}
