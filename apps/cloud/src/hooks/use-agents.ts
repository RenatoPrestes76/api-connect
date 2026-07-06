'use client';
import { useQuery } from '@tanstack/react-query';
import { listAgents } from '../services/atlas-api.js';
import type { AgentFilter } from '../types/atlas.js';
import { POLL_INTERVAL_MS } from '../lib/constants.js';

export function useAgents(filter: AgentFilter = {}) {
  return useQuery({
    queryKey:        ['agents', filter],
    queryFn:         () => listAgents(filter),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime:       10_000,
  });
}
