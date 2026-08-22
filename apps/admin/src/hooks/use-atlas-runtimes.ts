import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as atlasRuntimesService from '@/services/atlas-runtimes.service';
import type { AtlasRuntimeStatus } from '@/types/erp-platform';

const KEY = 'admin-atlas-runtimes';
const KEYS = 'admin-activation-keys';

export function useAtlasRuntimes(
  filters: {
    organizationId?: string;
    status?: AtlasRuntimeStatus;
  } = {}
): UseQueryResult<Awaited<ReturnType<typeof atlasRuntimesService.listAtlasRuntimes>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => atlasRuntimesService.listAtlasRuntimes(filters),
  });
}

export function useAtlasRuntime(
  id: string
): UseQueryResult<Awaited<ReturnType<typeof atlasRuntimesService.getAtlasRuntime>>> {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: () => atlasRuntimesService.getAtlasRuntime(id),
    enabled: Boolean(id),
  });
}

export function useBlockAtlasRuntime(): UseMutationResult<
  Awaited<ReturnType<typeof atlasRuntimesService.blockAtlasRuntime>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: atlasRuntimesService.blockAtlasRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReactivateAtlasRuntime(): UseMutationResult<
  Awaited<ReturnType<typeof atlasRuntimesService.reactivateAtlasRuntime>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: atlasRuntimesService.reactivateAtlasRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRevokeAtlasRuntimeCredentials(): UseMutationResult<
  Awaited<ReturnType<typeof atlasRuntimesService.revokeAtlasRuntimeCredentials>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: atlasRuntimesService.revokeAtlasRuntimeCredentials,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useActivationKeys(): UseQueryResult<
  Awaited<ReturnType<typeof atlasRuntimesService.listActivationKeys>>
> {
  return useQuery({ queryKey: [KEYS], queryFn: atlasRuntimesService.listActivationKeys });
}

export function useIssueActivationKey(): UseMutationResult<
  Awaited<ReturnType<typeof atlasRuntimesService.issueActivationKey>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: atlasRuntimesService.issueActivationKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS] }),
  });
}

export function useRevokeActivationKey(): UseMutationResult<
  Awaited<ReturnType<typeof atlasRuntimesService.revokeActivationKey>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: atlasRuntimesService.revokeActivationKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS] }),
  });
}
