'use client';
import { useQuery } from '@tanstack/react-query';
import { getSyncHistory, type SyncHistoryQuery } from '@/services/sync.service';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function useSyncHistory(query: SyncHistoryQuery = {}) {
  return useQuery({
    queryKey: ['sync-history', query],
    queryFn:  ({ signal }) => getSyncHistory(query, signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
