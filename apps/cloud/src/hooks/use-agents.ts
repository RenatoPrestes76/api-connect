'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listAgents } from '../services/atlas-api';
import type { AgentFilter } from '../types/atlas';
import { POLL_INTERVAL_MS } from '../lib/constants';

export function useAgents(
  filter: AgentFilter = {}
): UseQueryResult<Awaited<ReturnType<typeof listAgents>>> {
  return useQuery({
    queryKey: ['agents', filter],
    queryFn: () => listAgents(filter),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 10_000,
  });
}
