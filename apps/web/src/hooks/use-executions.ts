/**
 * Sprint 29 — ORCHESTRATOR
 * React Query hooks for execution history, stats and queue.
 */
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExecutions,
  fetchExecution,
  cancelExecution,
  fetchExecutionStats,
  fetchQueue,
  fetchDlq,
  retryDlqJob,
  purgeDlq,
} from '@/services/workflow.service';

const POLL_INTERVAL_MS = 5_000;

const KEYS = {
  list: (params?: object) => ['executions', params] as const,
  one: (id: string) => ['executions', id] as const,
  stats: ['execution-stats'] as const,
  queue: ['queue'] as const,
  dlq: ['dlq'] as const,
};

export function useExecutions(
  params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
  live = false
) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => fetchExecutions(params),
    refetchInterval: live ? POLL_INTERVAL_MS : false,
  });
}

export function useExecution(id: string, live = false) {
  return useQuery({
    queryKey: KEYS.one(id),
    queryFn: () => fetchExecution(id),
    enabled: !!id,
    refetchInterval: live ? POLL_INTERVAL_MS : false,
  });
}

export function useExecutionStats(live = false) {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: fetchExecutionStats,
    refetchInterval: live ? POLL_INTERVAL_MS : false,
  });
}

export function useCancelExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelExecution,
    onSuccess: (exec) => {
      qc.invalidateQueries({ queryKey: KEYS.list() });
      qc.setQueryData(KEYS.one(exec.id), exec);
    },
  });
}

export function useQueue(live = false) {
  return useQuery({
    queryKey: KEYS.queue,
    queryFn: fetchQueue,
    refetchInterval: live ? POLL_INTERVAL_MS : false,
  });
}

export function useDlq() {
  return useQuery({ queryKey: KEYS.dlq, queryFn: fetchDlq });
}

export function useRetryDlqJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryDlqJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.dlq });
      qc.invalidateQueries({ queryKey: KEYS.queue });
    },
  });
}

export function usePurgeDlq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purgeDlq,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.dlq }),
  });
}
