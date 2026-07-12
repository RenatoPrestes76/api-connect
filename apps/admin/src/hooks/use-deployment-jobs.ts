import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as jobsService from '@/services/deployment-jobs.service';

const KEY = 'deployment-jobs';

export function useDeploymentJobs(
  filters: { organizationId?: string; status?: string; mode?: string } = {}
) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => jobsService.listDeploymentJobs(filters),
    refetchInterval: 10_000,
  });
}

export function useDeploymentTasks(jobId: string | undefined) {
  return useQuery({
    queryKey: [KEY, jobId, 'tasks'],
    queryFn: () => jobsService.getDeploymentTasks(jobId as string),
    enabled: Boolean(jobId),
  });
}

export function useCreateDeploymentJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.createDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveDeploymentJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.approveDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectDeploymentJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.rejectDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRollbackDeploymentJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.rollbackDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
