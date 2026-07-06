'use client';
import { useQuery } from '@tanstack/react-query';
import { getAgent } from '../services/atlas-api.js';
import { POLL_INTERVAL_MS } from '../lib/constants.js';

export function useAgent(id: string) {
  return useQuery({
    queryKey:        ['agents', id],
    queryFn:         () => getAgent(id),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime:       10_000,
    enabled:         !!id,
  });
}
