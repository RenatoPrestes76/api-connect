import { crGet, crPost, crPatch, crDelete } from '@/lib/connector-registry-client';
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

export async function listConnectors(filters?: {
  category?: ConnectorCategory;
  status?: ConnectorStatus;
}): Promise<RegistryConnector[]> {
  const qs = new URLSearchParams();
  if (filters?.category) qs.set('category', filters.category);
  if (filters?.status) qs.set('status', filters.status);
  const q = qs.toString() ? `?${qs}` : '';
  const data = await crGet<{ connectors: RegistryConnector[] }>(`/connectors${q}`);
  return data.connectors;
}

export async function getConnector(id: string): Promise<RegistryConnector> {
  return crGet<RegistryConnector>(`/connectors/${id}`);
}

export async function createConnector(input: {
  identifier: string;
  name: string;
  category: ConnectorCategory;
  vendor: string;
  description: string;
  icon?: string;
  minRuntimeVersion: string;
}): Promise<RegistryConnector> {
  return crPost<RegistryConnector>('/connectors', input);
}

export async function updateConnector(
  id: string,
  patch: Partial<
    Pick<
      RegistryConnector,
      'name' | 'vendor' | 'description' | 'icon' | 'category' | 'minRuntimeVersion'
    >
  >
): Promise<RegistryConnector> {
  return crPatch<RegistryConnector>(`/connectors/${id}`, patch);
}

export async function activateConnector(id: string): Promise<RegistryConnector> {
  return crPost<RegistryConnector>(`/connectors/${id}/activate`);
}

export async function deactivateConnector(id: string): Promise<RegistryConnector> {
  return crPost<RegistryConnector>(`/connectors/${id}/deactivate`);
}

export async function deleteConnector(id: string): Promise<void> {
  await crDelete(`/connectors/${id}`);
}

export async function validateConnectorConfig(
  id: string,
  values: Record<string, string | number | boolean>
): Promise<{ valid: boolean; issues: ConfigValidationIssue[] }> {
  return crPost(`/connectors/${id}/validate`, values);
}

// ─── Versions ───────────────────────────────────────────────────────────────

export async function listVersions(connectorId: string): Promise<RegistryConnectorVersion[]> {
  const data = await crGet<{ versions: RegistryConnectorVersion[] }>(
    `/connectors/${connectorId}/versions`
  );
  return data.versions;
}

export async function publishVersion(
  connectorId: string,
  input: {
    version: string;
    changelog: string;
    status: ConnectorVersionStatus;
    minRuntimeVersion: string;
    dependencies?: string[];
  }
): Promise<RegistryConnectorVersion> {
  return crPost<RegistryConnectorVersion>(`/connectors/${connectorId}/versions`, input);
}

// ─── Parameters ─────────────────────────────────────────────────────────────

export async function listParameters(connectorId: string): Promise<RegistryConnectorParameter[]> {
  const data = await crGet<{ parameters: RegistryConnectorParameter[] }>(
    `/connectors/${connectorId}/parameters`
  );
  return data.parameters;
}

export async function createParameter(
  connectorId: string,
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
  }
): Promise<RegistryConnectorParameter> {
  return crPost<RegistryConnectorParameter>(`/connectors/${connectorId}/parameters`, input);
}

export async function updateParameter(
  connectorId: string,
  parameterId: string,
  patch: Partial<
    Pick<
      RegistryConnectorParameter,
      | 'label'
      | 'required'
      | 'defaultValue'
      | 'validationPattern'
      | 'options'
      | 'sensitive'
      | 'description'
      | 'order'
    >
  >
): Promise<RegistryConnectorParameter> {
  return crPatch<RegistryConnectorParameter>(
    `/connectors/${connectorId}/parameters/${parameterId}`,
    patch
  );
}

export async function deleteParameter(connectorId: string, parameterId: string): Promise<void> {
  await crDelete(`/connectors/${connectorId}/parameters/${parameterId}`);
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(connectorId: string): Promise<RegistryConnectorTemplate[]> {
  const data = await crGet<{ templates: RegistryConnectorTemplate[] }>(
    `/connectors/${connectorId}/templates`
  );
  return data.templates;
}

export async function createTemplate(
  connectorId: string,
  input: { name: string; description?: string; values: Record<string, string | number | boolean> }
): Promise<RegistryConnectorTemplate> {
  return crPost<RegistryConnectorTemplate>(`/connectors/${connectorId}/templates`, input);
}

export async function deleteTemplate(connectorId: string, templateId: string): Promise<void> {
  await crDelete(`/connectors/${connectorId}/templates/${templateId}`);
}
