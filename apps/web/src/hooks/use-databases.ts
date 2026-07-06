'use client';
import { useQuery } from '@tanstack/react-query';
import { listDatabases, getDatabase } from '@/services/databases.service';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn:  ({ signal }) => listDatabases(signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useDatabase(id: string) {
  return useQuery({
    queryKey: ['databases', id],
    queryFn:  ({ signal }) => getDatabase(id, signal),
    refetchInterval: POLL_INTERVAL_MS,
    enabled:  !!id,
  });
}
