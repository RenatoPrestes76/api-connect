import { api } from './api-client';
import type {
  StartResponse,
  CompanyFormData,
  AdminFormData,
  DatabaseFormData,
  ConnectorFormData,
  AgentFormData,
  SecretsFormData,
  ProvisionResponse,
  FinishResponse,
} from '@/types/setup';

const BASE = '/api/v1/setup';

export const startSetup = (): Promise<StartResponse> => api.post(`${BASE}/start`);

export const submitCompany = (sessionId: string, data: CompanyFormData): Promise<any> =>
  api.post(`${BASE}/company`, {
    sessionId,
    name: data.name,
    cnpj: data.cnpj || undefined,
    domain: data.domain,
    plan: data.plan,
    timezone: data.timezone,
    locale: data.locale,
    workspace: {
      name: data.workspaceName || data.name,
      environment: data.workspaceEnvironment,
    },
  });

export const submitAdmin = (sessionId: string, data: AdminFormData): Promise<any> =>
  api.post(`${BASE}/admin`, {
    sessionId,
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone || undefined,
    mfaEnabled: data.mfaEnabled,
  });

export const submitDatabase = (sessionId: string, data: DatabaseFormData): Promise<any> =>
  api.post(`${BASE}/database`, {
    sessionId,
    type: data.type,
    host: data.host,
    port: Number(data.port) || 5432,
    database: data.database,
    username: data.username,
    ssl: data.ssl,
  });

export const submitConnector = (sessionId: string, data: ConnectorFormData): Promise<any> =>
  api.post(`${BASE}/connector`, {
    sessionId,
    type: data.type,
    name: data.name,
    baseUrl: data.baseUrl || undefined,
  });

export const submitSecrets = (sessionId: string, data: SecretsFormData): Promise<any> =>
  api.post(`${BASE}/secrets`, { sessionId, provider: data.provider });

export const runProvision = (sessionId: string, agent: AgentFormData): Promise<ProvisionResponse> =>
  api.post(`${BASE}/provision`, {
    sessionId,
    agentName: agent.name,
    agentType: agent.type,
  });

export const getSetupStatus = (sessionId: string): Promise<any> =>
  api.get(`${BASE}/status?sessionId=${sessionId}`);

export const finishSetup = (sessionId: string): Promise<FinishResponse> =>
  api.post(`${BASE}/finish`, { sessionId });
