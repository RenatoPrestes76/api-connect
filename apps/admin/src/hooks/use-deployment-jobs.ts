import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as jobsService from '@/services/deployment-jobs.service';

const KEY = 'deployment-jobs';

export function useDeploymentJobs(
  filters: { organizationId?: string; status?: string; mode?: string } = {}
): UseQueryResult<Awaited<ReturnType<typeof jobsService.listDeploymentJobs>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => jobsService.listDeploymentJobs(filters),
    refetchInterval: 10_000,
  });
}

export function useDeploymentTasks(
  jobId: string | undefined
): UseQueryResult<Awaited<ReturnType<typeof jobsService.getDeploymentTasks>>> {
  return useQuery({
    queryKey: [KEY, jobId, 'tasks'],
    queryFn: () => jobsService.getDeploymentTasks(jobId as string),
    enabled: Boolean(jobId),
  });
}

export function useCreateDeploymentJob(): UseMutationResult<
  Awaited<ReturnType<typeof jobsService.createDeploymentJob>>,
  Error,
  Parameters<typeof jobsService.createDeploymentJob>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.createDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveDeploymentJob(): UseMutationResult<
  Awaited<ReturnType<typeof jobsService.approveDeploymentJob>>,
  Error,
  Parameters<typeof jobsService.approveDeploymentJob>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.approveDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectDeploymentJob(): UseMutationResult<
  Awaited<ReturnType<typeof jobsService.rejectDeploymentJob>>,
  Error,
  Parameters<typeof jobsService.rejectDeploymentJob>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.rejectDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRollbackDeploymentJob(): UseMutationResult<
  Awaited<ReturnType<typeof jobsService.rollbackDeploymentJob>>,
  Error,
  Parameters<typeof jobsService.rollbackDeploymentJob>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: jobsService.rollbackDeploymentJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
