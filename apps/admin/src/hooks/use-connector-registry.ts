import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as connectorRegistryService from '@/services/connector-registry.service';
import type {
  RegistryConnector,
  ConnectorCategory,
  ConnectorStatus,
  ConnectorVersionStatus,
  ParameterType,
} from '@/types/connector-registry';

const KEY = 'connector-registry';

export function useRegistryConnectors(filters?: {
  category?: ConnectorCategory;
  status?: ConnectorStatus;
}) {
  return useQuery({
    queryKey: [KEY, 'connectors', filters],
    queryFn: () => connectorRegistryService.listConnectors(filters),
  });
}

export function useRegistryConnector(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'connector', id],
    queryFn: () => connectorRegistryService.getConnector(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateRegistryConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectorRegistryService.createConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'connectors'] }),
  });
}

export function useUpdateRegistryConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          RegistryConnector,
          'name' | 'vendor' | 'description' | 'icon' | 'category' | 'minRuntimeVersion'
        >
      >;
    }) => connectorRegistryService.updateConnector(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetRegistryConnectorActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? connectorRegistryService.activateConnector(id)
        : connectorRegistryService.deactivateConnector(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteRegistryConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectorRegistryService.deleteConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'connectors'] }),
  });
}

export function useValidateConnectorConfig() {
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Record<string, string | number | boolean>;
    }) => connectorRegistryService.validateConnectorConfig(id, values),
  });
}

// ─── Versions ───────────────────────────────────────────────────────────────

export function useRegistryVersions(connectorId: string | null) {
  return useQuery({
    queryKey: [KEY, 'versions', connectorId],
    queryFn: () => connectorRegistryService.listVersions(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function usePublishRegistryVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      input,
    }: {
      connectorId: string;
      input: {
        version: string;
        changelog: string;
        status: ConnectorVersionStatus;
        minRuntimeVersion: string;
        dependencies?: string[];
      };
    }) => connectorRegistryService.publishVersion(connectorId, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [KEY, 'versions', variables.connectorId] });
      qc.invalidateQueries({ queryKey: [KEY, 'connectors'] });
      qc.invalidateQueries({ queryKey: [KEY, 'connector', variables.connectorId] });
    },
  });
}

// ─── Parameters ─────────────────────────────────────────────────────────────

export function useRegistryParameters(connectorId: string | null) {
  return useQuery({
    queryKey: [KEY, 'parameters', connectorId],
    queryFn: () => connectorRegistryService.listParameters(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateRegistryParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      input,
    }: {
      connectorId: string;
      input: {
        key: string;
        label: string;
        type: ParameterType;
        required?: boolean;
        defaultValue?: string | number | boolean;
        validationPattern?: string;
        options?: string[];
        sensitive?: boolean;
        description?: string;
        order?: number;
      };
    }) => connectorRegistryService.createParameter(connectorId, input),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'parameters', variables.connectorId] }),
  });
}

export function useDeleteRegistryParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, parameterId }: { connectorId: string; parameterId: string }) =>
      connectorRegistryService.deleteParameter(connectorId, parameterId),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'parameters', variables.connectorId] }),
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useRegistryTemplates(connectorId: string | null) {
  return useQuery({
    queryKey: [KEY, 'templates', connectorId],
    queryFn: () => connectorRegistryService.listTemplates(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateRegistryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      input,
    }: {
      connectorId: string;
      input: {
        name: string;
        description?: string;
        values: Record<string, string | number | boolean>;
      };
    }) => connectorRegistryService.createTemplate(connectorId, input),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'templates', variables.connectorId] }),
  });
}

export function useDeleteRegistryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, templateId }: { connectorId: string; templateId: string }) =>
      connectorRegistryService.deleteTemplate(connectorId, templateId),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'templates', variables.connectorId] }),
  });
}
