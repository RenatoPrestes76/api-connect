'use client';
import { useQuery } from '@tanstack/react-query';
import { getLogs } from '@/services/logs.service';
import type { LogQuery } from '@/types/index';
import { LOG_POLL_MS } from '@/lib/constants';

export function useLogs(query: LogQuery = {}, live = false) {
  return useQuery({
    queryKey: ['logs', query],
    queryFn: ({ signal }) => getLogs(query, signal),
    refetchInterval: live ? LOG_POLL_MS : false,
  });
}
