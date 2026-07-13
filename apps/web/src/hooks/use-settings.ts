'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/settings.service';
import type { HubSettings } from '@/types/index';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => getSettings(signal),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<HubSettings>) => updateSettings(settings),
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  });
}
