'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listConnectors, getConnector } from '@/services/connectors.service';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function useConnectors() {
  return useQuery({
    queryKey: ['connectors'],
    queryFn:  ({ signal }) => listConnectors(signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useConnector(id: string) {
  return useQuery({
    queryKey: ['connectors', id],
    queryFn:  ({ signal }) => getConnector(id, signal),
    refetchInterval: POLL_INTERVAL_MS,
    enabled:  !!id,
  });
}

export function useInvalidateConnectors() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['connectors'] });
}
