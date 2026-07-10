'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as copilot from '@/services/copilot.service';
import type {
  ChatRequest,
  DiagnoseRequest,
  GenerateRequest,
  ExplainRequest,
  SearchRequest,
} from '@/types/copilot';

// ─── Conversations ────────────────────────────────────────────────────────────

export const useConversations = () =>
  useQuery({
    queryKey: ['copilot', 'conversations'],
    queryFn: copilot.fetchConversations,
  });

export const useConversation = (id: string | null) =>
  useQuery({
    queryKey: ['copilot', 'conversations', id],
    queryFn: () => copilot.fetchConversation(id!),
    enabled: Boolean(id),
  });

export const useDeleteConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: copilot.deleteConversation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['copilot', 'conversations'] });
    },
  });
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ChatRequest) => copilot.sendMessage(req),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ['copilot', 'conversations'] });
      if (conversationId) {
        qc.invalidateQueries({ queryKey: ['copilot', 'conversations', conversationId] });
      }
    },
  });
};

// ─── AI features ──────────────────────────────────────────────────────────────

export const useDiagnose = () =>
  useMutation({ mutationFn: (req: DiagnoseRequest) => copilot.diagnose(req) });

export const useGenerate = () =>
  useMutation({ mutationFn: (req: GenerateRequest) => copilot.generate(req) });

export const useExplain = () =>
  useMutation({ mutationFn: (req: ExplainRequest) => copilot.explain(req) });

export const useSearch = () =>
  useMutation({ mutationFn: (req: SearchRequest) => copilot.search(req) });

// ─── Audit ────────────────────────────────────────────────────────────────────

export const useCopilotAudit = (params?: { action?: string; limit?: number }) =>
  useQuery({
    queryKey: ['copilot', 'audit', params],
    queryFn: () => copilot.fetchCopilotAudit(params),
  });
