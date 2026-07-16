import { cpGet, cpPost, cpPatch, cpDelete } from '@/lib/control-plane-client';
import type { Project } from '@/types/control-plane';

export async function listProjects(organizationId?: string): Promise<Project[]> {
  const qs = organizationId ? `?organizationId=${organizationId}` : '';
  const data = await cpGet<{ projects: Project[] }>(`/projects${qs}`);
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  return cpGet<Project>(`/projects/${id}`);
}

export async function createProject(input: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<Project> {
  return cpPost<Project>('/projects', input);
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'status' | 'description'>>
): Promise<Project> {
  return cpPatch<Project>(`/projects/${id}`, patch);
}

export async function deleteProject(id: string): Promise<void> {
  await cpDelete(`/projects/${id}`);
}
