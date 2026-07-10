/**
 * Sprint 29 — ORCHESTRATOR
 * React Query hooks for workflow CRUD and versioning.
 */
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkflows,
  fetchWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  runWorkflow,
  fetchWorkflowVersions,
} from '@/services/workflow.service';
import type { Workflow, WorkflowVersion, TriggerType, WorkflowGraph } from '@/types/workflow';

const KEYS = {
  all: ['workflows'] as const,
  one: (id: string) => ['workflows', id] as const,
  versions: (id: string) => ['workflows', id, 'versions'] as const,
};

export function useWorkflows() {
  return useQuery({ queryKey: KEYS.all, queryFn: fetchWorkflows });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: KEYS.one(id),
    queryFn: () => fetchWorkflow(id),
    enabled: !!id,
  });
}

export function useWorkflowVersions(id: string) {
  return useQuery({
    queryKey: KEYS.versions(id),
    queryFn: () => fetchWorkflowVersions(id),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Workflow> & { graph?: WorkflowGraph; note?: string };
    }) => updateWorkflow(id, body),
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.one(wf.id) });
      qc.invalidateQueries({ queryKey: KEYS.versions(wf.id) });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useActivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateWorkflow,
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.setQueryData(KEYS.one(wf.id), wf);
    },
  });
}

export function useDeactivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deactivateWorkflow,
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.setQueryData(KEYS.one(wf.id), wf);
    },
  });
}

export function useRunWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: Record<string, unknown> }) =>
      runWorkflow(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['executions'] });
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

// Re-export type for convenience in pages
export type { TriggerType };
