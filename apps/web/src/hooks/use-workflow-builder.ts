'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as wb from '@/services/workflow-builder.service';
import type { PlanRequest } from '@/types/workflow-builder';
import type { WorkflowGraph } from '@/types/workflow';

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const usePlanWorkflow = () =>
  useMutation({ mutationFn: (req: PlanRequest) => wb.planWorkflow(req) });

// ─── Validate ─────────────────────────────────────────────────────────────────

export const useValidateGraph = () =>
  useMutation({ mutationFn: (graph: WorkflowGraph) => wb.validateGraph(graph) });

// ─── Simulate ─────────────────────────────────────────────────────────────────

export const useSimulateWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: Record<string, unknown> }) =>
      wb.simulateWorkflow(id, input),
  });
};

// ─── Templates ────────────────────────────────────────────────────────────────

export const useTemplates = (category?: string) =>
  useQuery({
    queryKey: ['wb-templates', category],
    queryFn: () => wb.fetchTemplates(category),
  });

export const useTemplate = (id: string) =>
  useQuery({
    queryKey: ['wb-template', id],
    queryFn: () => wb.fetchTemplate(id),
    enabled: !!id,
  });

export const useUseTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name?: string; description?: string }) =>
      wb.useTemplate(id, { name, description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
};

// ─── Versions ─────────────────────────────────────────────────────────────────

export const useVersions = (workflowId: string) =>
  useQuery({
    queryKey: ['wb-versions', workflowId],
    queryFn: () => wb.fetchVersions(workflowId),
    enabled: !!workflowId,
  });

export const useSaveVersion = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ note, author }: { note?: string; author?: string }) =>
      wb.saveVersion(workflowId, note, author),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wb-versions', workflowId] }),
  });
};

export const useRollback = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => wb.rollbackWorkflow(workflowId, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', workflowId] });
      qc.invalidateQueries({ queryKey: ['wb-versions', workflowId] });
    },
  });
};
