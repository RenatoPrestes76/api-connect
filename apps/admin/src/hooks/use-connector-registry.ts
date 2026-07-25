import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as connectorRegistryService from '@/services/connector-registry.service';
import type {
  RegistryConnector,
  RegistryConnectorVersion,
  RegistryConnectorParameter,
  RegistryConnectorTemplate,
  ConnectorCategory,
  ConnectorStatus,
  ConnectorVersionStatus,
  ParameterType,
  ConfigValidationIssue,
} from '@/types/connector-registry';

const KEY = 'connector-registry';

export function useRegistryConnectors(filters?: {
  category?: ConnectorCategory;
  status?: ConnectorStatus;
}): UseQueryResult<RegistryConnector[]> {
  return useQuery({
    queryKey: [KEY, 'connectors', filters],
    queryFn: () => connectorRegistryService.listConnectors(filters),
  });
}

export function useRegistryConnector(id: string | null): UseQueryResult<RegistryConnector> {
  return useQuery({
    queryKey: [KEY, 'connector', id],
    queryFn: () => connectorRegistryService.getConnector(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateRegistryConnector(): UseMutationResult<
  RegistryConnector,
  Error,
  Parameters<typeof connectorRegistryService.createConnector>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectorRegistryService.createConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'connectors'] }),
  });
}

export function useUpdateRegistryConnector(): UseMutationResult<
  RegistryConnector,
  Error,
  {
    id: string;
    patch: Partial<
      Pick<
        RegistryConnector,
        'name' | 'vendor' | 'description' | 'icon' | 'category' | 'minRuntimeVersion'
      >
    >;
  }
> {
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

export function useSetRegistryConnectorActive(): UseMutationResult<
  RegistryConnector,
  Error,
  { id: string; active: boolean }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? connectorRegistryService.activateConnector(id)
        : connectorRegistryService.deactivateConnector(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteRegistryConnector(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: connectorRegistryService.deleteConnector,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'connectors'] }),
  });
}

export function useValidateConnectorConfig(): UseMutationResult<
  { valid: boolean; issues: ConfigValidationIssue[] },
  Error,
  { id: string; values: Record<string, string | number | boolean> }
> {
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

export function useRegistryVersions(
  connectorId: string | null
): UseQueryResult<RegistryConnectorVersion[]> {
  return useQuery({
    queryKey: [KEY, 'versions', connectorId],
    queryFn: () => connectorRegistryService.listVersions(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function usePublishRegistryVersion(): UseMutationResult<
  RegistryConnectorVersion,
  Error,
  {
    connectorId: string;
    input: {
      version: string;
      changelog: string;
      status: ConnectorVersionStatus;
      minRuntimeVersion: string;
      dependencies?: string[];
    };
  }
> {
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

export function useRegistryParameters(
  connectorId: string | null
): UseQueryResult<RegistryConnectorParameter[]> {
  return useQuery({
    queryKey: [KEY, 'parameters', connectorId],
    queryFn: () => connectorRegistryService.listParameters(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateRegistryParameter(): UseMutationResult<
  RegistryConnectorParameter,
  Error,
  {
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
  }
> {
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

export function useDeleteRegistryParameter(): UseMutationResult<
  void,
  Error,
  { connectorId: string; parameterId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, parameterId }: { connectorId: string; parameterId: string }) =>
      connectorRegistryService.deleteParameter(connectorId, parameterId),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'parameters', variables.connectorId] }),
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useRegistryTemplates(
  connectorId: string | null
): UseQueryResult<RegistryConnectorTemplate[]> {
  return useQuery({
    queryKey: [KEY, 'templates', connectorId],
    queryFn: () => connectorRegistryService.listTemplates(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateRegistryTemplate(): UseMutationResult<
  RegistryConnectorTemplate,
  Error,
  {
    connectorId: string;
    input: {
      name: string;
      description?: string;
      values: Record<string, string | number | boolean>;
    };
  }
> {
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

export function useDeleteRegistryTemplate(): UseMutationResult<
  void,
  Error,
  { connectorId: string; templateId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, templateId }: { connectorId: string; templateId: string }) =>
      connectorRegistryService.deleteTemplate(connectorId, templateId),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: [KEY, 'templates', variables.connectorId] }),
  });
}
