import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as projectsService from '@/services/projects.service';
import type { Project } from '@/types/control-plane';

const KEY = 'admin-projects';

export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: [KEY, organizationId],
    queryFn: () => projectsService.listProjects(organizationId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsService.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateProject() {
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

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsService.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
