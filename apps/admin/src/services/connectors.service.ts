import { cpGet, cpPost } from '@/lib/control-plane-client';
import type { Connector, ConnectorVersion } from '@/types/control-plane';

export async function listConnectors(
  filters: { status?: string; category?: string } = {}
): Promise<Connector[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  const qs = params.toString();
  const data = await cpGet<{ connectors: Connector[] }>(`/connectors${qs ? `?${qs}` : ''}`);
  return data.connectors;
}

export async function getConnector(id: string): Promise<Connector> {
  return cpGet<Connector>(`/connectors/${id}`);
}

export async function listConnectorVersions(connectorId: string): Promise<ConnectorVersion[]> {
  const data = await cpGet<{ versions: ConnectorVersion[] }>(`/connectors/${connectorId}/versions`);
  return data.versions;
}

export async function createConnectorVersion(
  connectorId: string,
  input: { version: string; changelog?: string }
): Promise<ConnectorVersion> {
  return cpPost<ConnectorVersion>(`/connectors/${connectorId}/versions`, input);
}

export async function publishConnectorVersion(
  connectorId: string,
  versionId: string
): Promise<ConnectorVersion> {
  return cpPost<ConnectorVersion>(`/connectors/${connectorId}/versions/${versionId}/publish`);
}
