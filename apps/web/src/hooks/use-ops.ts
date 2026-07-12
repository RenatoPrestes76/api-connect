'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ops from '@/services/ops.service';

// ─── Health ──────────────────────────────────────────────────────────────────
export const useHealth = () =>
  useQuery({ queryKey: ['ops', 'health'], queryFn: ops.getHealth, refetchInterval: 30_000 });

export const useReadiness = () =>
  useQuery({ queryKey: ['ops', 'ready'], queryFn: ops.getReadiness });

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const useOpsDashboard = () =>
  useQuery({
    queryKey: ['ops', 'dashboard'],
    queryFn: ops.getOpsDashboard,
    refetchInterval: 60_000,
  });

// ─── Queues ──────────────────────────────────────────────────────────────────
export const useQueues = (priority?: string) =>
  useQuery({ queryKey: ['ops', 'queues', priority], queryFn: () => ops.getQueues(priority) });

export const useEnqueueJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ops.enqueueJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'queues'] }),
  });
};

export const useRetryDlqJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => ops.retryDlqJob(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'queues'] }),
  });
};

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const useFeatureFlags = () =>
  useQuery({ queryKey: ['ops', 'feature-flags'], queryFn: ops.listFeatureFlags });

export const useFeatureFlag = (id: string) =>
  useQuery({ queryKey: ['ops', 'feature-flags', id], queryFn: () => ops.getFeatureFlag(id) });

export const useUpdateFeatureFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ops.updateFeatureFlag(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'feature-flags'] }),
  });
};

export const useCreateFeatureFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ops.createFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'feature-flags'] }),
  });
};

export const useDeleteFeatureFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ops.deleteFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'feature-flags'] }),
  });
};

// ─── SLO ─────────────────────────────────────────────────────────────────────
export const useSlos = () => useQuery({ queryKey: ['ops', 'slo'], queryFn: ops.getSlos });

// ─── DR ──────────────────────────────────────────────────────────────────────
export const useDr = () => useQuery({ queryKey: ['ops', 'dr'], queryFn: ops.getDr });

export const useTriggerBackup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: string) => ops.triggerBackup(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'dr'] }),
  });
};

export const useRunDrTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ops.runDrTest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'dr'] }),
  });
};

// ─── Circuit Breakers ─────────────────────────────────────────────────────────
export const useCircuitBreakers = () =>
  useQuery({
    queryKey: ['ops', 'circuits'],
    queryFn: ops.getCircuitBreakers,
    refetchInterval: 15_000,
  });

export const useResetCircuit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => ops.resetCircuit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'circuits'] }),
  });
};
