'use client';
import { useQuery } from '@tanstack/react-query';
import { listAgents, getAgent } from '@/services/agents.service';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: ({ signal }) => listAgents(signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: ({ signal }) => getAgent(id, signal),
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!id,
  });
}
