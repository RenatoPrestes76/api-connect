import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as projectsService from '@/services/projects.service';
import type { Project } from '@/types/control-plane';

const KEY = 'admin-projects';

export function useProjects(
  organizationId?: string
): UseQueryResult<Awaited<ReturnType<typeof projectsService.listProjects>>> {
  return useQuery({
    queryKey: [KEY, organizationId],
    queryFn: () => projectsService.listProjects(organizationId),
  });
}

export function useCreateProject(): UseMutationResult<
  Awaited<ReturnType<typeof projectsService.createProject>>,
  Error,
  Parameters<typeof projectsService.createProject>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsService.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateProject(): UseMutationResult<
  Awaited<ReturnType<typeof projectsService.updateProject>>,
  Error,
  { id: string; patch: Partial<Pick<Project, 'name' | 'status' | 'description'>> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Project, 'name' | 'status' | 'description'>>;
    }) => projectsService.updateProject(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteProject(): UseMutationResult<
  Awaited<ReturnType<typeof projectsService.deleteProject>>,
  Error,
  Parameters<typeof projectsService.deleteProject>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsService.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
