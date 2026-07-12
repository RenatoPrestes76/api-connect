import { fleetGet, fleetPost } from '@/lib/fleet-client';
import type { DeploymentJob, DeploymentMode, DeploymentTask } from '@/types/fleet';

export async function listDeploymentJobs(
  filters: { organizationId?: string; status?: string; mode?: string } = {}
): Promise<DeploymentJob[]> {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set('organizationId', filters.organizationId);
  if (filters.status) params.set('status', filters.status);
  if (filters.mode) params.set('mode', filters.mode);
  const qs = params.toString();
  const data = await fleetGet<{ jobs: DeploymentJob[] }>(`/deployments${qs ? `?${qs}` : ''}`);
  return data.jobs;
}

export async function getDeploymentTasks(jobId: string): Promise<DeploymentTask[]> {
  const data = await fleetGet<{ tasks: DeploymentTask[] }>(`/deployments/${jobId}/tasks`);
  return data.tasks;
}

export async function createDeploymentJob(input: {
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
  mode: DeploymentMode;
  scheduledAt?: string;
}): Promise<DeploymentJob> {
  return fleetPost<DeploymentJob>('/deployments', input);
}

export async function approveDeploymentJob(id: string): Promise<DeploymentJob> {
  return fleetPost<DeploymentJob>(`/deployments/${id}/approve`);
}

export async function rejectDeploymentJob(id: string): Promise<DeploymentJob> {
  return fleetPost<DeploymentJob>(`/deployments/${id}/reject`);
}

export async function rollbackDeploymentJob(id: string): Promise<DeploymentJob> {
  return fleetPost<DeploymentJob>(`/deployments/${id}/rollback`);
}
