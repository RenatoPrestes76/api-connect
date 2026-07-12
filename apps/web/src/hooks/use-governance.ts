import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { governanceService } from '@/services/governance.service';
import type {
  CreatePolicyPayload,
  CreateRiskPayload,
  CreateChangePayload,
  ApproveChangePayload,
  RejectChangePayload,
} from '@/types/governance';

export function usePolicies(params?: { category?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['governance-policies', params],
    queryFn: () => governanceService.getPolicies(params),
    refetchInterval: 60_000,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreatePolicyPayload) => governanceService.createPolicy(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['governance-policies'] }),
  });
}

export function useAuditLogs(params?: {
  actor?: string;
  action?: string;
  tenantId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => governanceService.getAuditLogs(params),
    refetchInterval: 30_000,
  });
}

export function useComplianceStatus() {
  return useQuery({
    queryKey: ['compliance-status'],
    queryFn: () => governanceService.getComplianceStatus(),
    refetchInterval: 60_000,
  });
}

export function useComplianceEvidence(params?: { framework?: string; status?: string }) {
  return useQuery({
    queryKey: ['compliance-evidence', params],
    queryFn: () => governanceService.getEvidence(params),
    refetchInterval: 60_000,
  });
}

export function useRisks(params?: { category?: string; status?: string; severity?: string }) {
  return useQuery({
    queryKey: ['risks', params],
    queryFn: () => governanceService.getRisks(params),
    refetchInterval: 60_000,
  });
}

export function useCreateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateRiskPayload) => governanceService.createRisk(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks'] }),
  });
}

export function useChanges(params?: { status?: string; type?: string; priority?: string }) {
  return useQuery({
    queryKey: ['changes', params],
    queryFn: () => governanceService.getChanges(params),
    refetchInterval: 30_000,
  });
}

export function useCreateChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateChangePayload) => governanceService.createChange(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['changes'] }),
  });
}

export function useApproveChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveChangePayload }) =>
      governanceService.approveChange(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['changes'] }),
  });
}

export function useRejectChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectChangePayload }) =>
      governanceService.rejectChange(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['changes'] }),
  });
}
