'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { releaseService } from '@/services/release.service';
import type { ChecklistStatus } from '@/types/release';

export function useChecklist() {
  return useQuery({
    queryKey: ['release', 'checklist'],
    queryFn: () => releaseService.getChecklist(),
  });
}

export function useMarkChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
      checkedBy,
    }: {
      id: string;
      status: ChecklistStatus;
      notes?: string;
      checkedBy?: string;
    }) => releaseService.markChecklistItem(id, status, { notes, checkedBy }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release', 'checklist'] }),
  });
}

export function useReleaseVersions() {
  return useQuery({
    queryKey: ['release', 'versions'],
    queryFn: () => releaseService.listVersions(),
  });
}

export function useCurrentVersion() {
  return useQuery({
    queryKey: ['release', 'versions', 'current'],
    queryFn: () => releaseService.getCurrentVersion(),
  });
}

export function useChangelog(q?: string) {
  return useQuery({
    queryKey: ['release', 'changelog', q],
    queryFn: () => releaseService.getChangelog(q),
  });
}

export function useChangelogVersion(version: string) {
  return useQuery({
    queryKey: ['release', 'changelog', version],
    queryFn: () => releaseService.getChangelogVersion(version),
    enabled: !!version,
  });
}

export function useSBOM() {
  return useQuery({
    queryKey: ['release', 'sbom'],
    queryFn: () => releaseService.getSBOM(),
    staleTime: 60_000 * 10,
  });
}

export function useGoLiveMetrics() {
  return useQuery({
    queryKey: ['release', 'metrics'],
    queryFn: () => releaseService.getMetrics(),
    refetchInterval: 60_000,
  });
}
