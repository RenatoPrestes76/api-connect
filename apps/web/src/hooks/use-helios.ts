'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { heliosService } from '@/services/helios.service';

export const useTopics = (params?: Parameters<typeof heliosService.getTopics>[0]) =>
  useQuery({
    queryKey: ['helios-topics', params],
    queryFn: () => heliosService.getTopics(params),
    refetchInterval: 10_000,
  });

export const useTopic = (id: string) =>
  useQuery({
    queryKey: ['helios-topic', id],
    queryFn: () => heliosService.getTopicById(id),
    enabled: !!id,
  });

export const useTopicMessages = (id: string) =>
  useQuery({
    queryKey: ['helios-messages', id],
    queryFn: () => heliosService.getTopicMessages(id),
    enabled: !!id,
    refetchInterval: 5_000,
  });

export const useClusters = () =>
  useQuery({
    queryKey: ['helios-clusters'],
    queryFn: heliosService.getClusters,
    refetchInterval: 15_000,
  });

export const useStreamMetrics = () =>
  useQuery({
    queryKey: ['helios-stream-metrics'],
    queryFn: heliosService.getStreamMetrics,
    refetchInterval: 3_000,
  });

export const useTopicMetrics = () =>
  useQuery({
    queryKey: ['helios-topic-metrics'],
    queryFn: heliosService.getTopicMetrics,
    refetchInterval: 5_000,
  });

export const useCatalog = (params?: Parameters<typeof heliosService.getCatalog>[0]) =>
  useQuery({
    queryKey: ['helios-catalog', params],
    queryFn: () => heliosService.getCatalog(params),
  });

export const useCatalogEntry = (eventType: string) =>
  useQuery({
    queryKey: ['helios-catalog-entry', eventType],
    queryFn: () => heliosService.getCatalogEntry(eventType),
    enabled: !!eventType,
  });

export const useSchemas = (status?: string) =>
  useQuery({
    queryKey: ['helios-schemas', status],
    queryFn: () => heliosService.getSchemas(status),
  });

export const useSchemaVersions = (eventType: string) =>
  useQuery({
    queryKey: ['helios-schema-versions', eventType],
    queryFn: () => heliosService.getSchemaVersions(eventType),
    enabled: !!eventType,
  });

export const useRollbackSchema = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventType, version }: { eventType: string; version: string }) =>
      heliosService.rollbackSchema(eventType, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helios-schemas'] }),
  });
};

export const useReplayJobs = (params?: Parameters<typeof heliosService.getReplayJobs>[0]) =>
  useQuery({
    queryKey: ['helios-replay', params],
    queryFn: () => heliosService.getReplayJobs(params),
    refetchInterval: 10_000,
  });

export const useCreateReplay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heliosService.createReplayJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helios-replay'] }),
  });
};

export const useDLQ = (status?: string) =>
  useQuery({
    queryKey: ['helios-dlq', status],
    queryFn: () => heliosService.getDLQEntries(status),
    refetchInterval: 15_000,
  });

export const useRequeueDLQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heliosService.requeueDLQ,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helios-dlq'] }),
  });
};

export const useDiscardDLQ = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heliosService.discardDLQ,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helios-dlq'] }),
  });
};

export const useSecurityPolicies = (topicId?: string) =>
  useQuery({
    queryKey: ['helios-sec-policies', topicId],
    queryFn: () => heliosService.getSecurityPolicies(topicId),
  });

export const useSecurityAudit = (params?: Parameters<typeof heliosService.getSecurityAudit>[0]) =>
  useQuery({
    queryKey: ['helios-sec-audit', params],
    queryFn: () => heliosService.getSecurityAudit(params),
    refetchInterval: 15_000,
  });

export const useGovernancePolicies = (
  params?: Parameters<typeof heliosService.getGovernancePolicies>[0]
) =>
  useQuery({
    queryKey: ['helios-governance', params],
    queryFn: () => heliosService.getGovernancePolicies(params),
  });

export const useAIInsights = (type?: string) =>
  useQuery({
    queryKey: ['helios-ai-insights', type],
    queryFn: () => heliosService.getAIInsights(type),
  });

export const useForecasts = (topicId?: string) =>
  useQuery({
    queryKey: ['helios-forecasts', topicId],
    queryFn: () => heliosService.getForecasts(topicId),
  });

export const useTwinTopology = () =>
  useQuery({
    queryKey: ['helios-twin-topology'],
    queryFn: heliosService.getTwinTopology,
    refetchInterval: 5_000,
  });

export const useTwinFlow = (orderId: string) =>
  useQuery({
    queryKey: ['helios-twin-flow', orderId],
    queryFn: () => heliosService.getTwinFlow(orderId),
    enabled: !!orderId,
    refetchInterval: 5_000,
  });

export const useMarketplace = (params?: Parameters<typeof heliosService.getMarketplaceEvents>[0]) =>
  useQuery({
    queryKey: ['helios-marketplace', params],
    queryFn: () => heliosService.getMarketplaceEvents(params),
  });

export const useBridges = (params?: Parameters<typeof heliosService.getBridges>[0]) =>
  useQuery({
    queryKey: ['helios-bridges', params],
    queryFn: () => heliosService.getBridges(params),
    refetchInterval: 15_000,
  });

export const useReconnectBridge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: heliosService.reconnectBridge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helios-bridges'] }),
  });
};
