'use client';
import { useState, useCallback } from 'react';
import * as setupService from '@/services/setup.service';
import type {
  WizardState,
  SetupStep,
  CompanyFormData,
  AdminFormData,
  DatabaseFormData,
  ConnectorFormData,
  AgentFormData,
  SecretsFormData,
  ProvisionResponse,
  FinishResponse,
} from '@/types/setup';

const INITIAL_STATE: WizardState = {
  sessionId: null,
  step: 'company',
  loading: false,
  error: null,
  company: null,
  admin: null,
  database: null,
  connector: null,
  agent: null,
  secrets: null,
  provisionResult: null,
  finishResult: null,
};

export function useSetupWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const setLoading = (loading: boolean) => setState((s) => ({ ...s, loading, error: null }));

  const setError = (error: string) => setState((s) => ({ ...s, loading: false, error }));

  const advance = (step: SetupStep, patch?: Partial<WizardState>) =>
    setState((s) => ({ ...s, step, loading: false, error: null, ...patch }));

  const startSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await setupService.startSetup();
      setState((s) => ({ ...s, sessionId: data.sessionId, loading: false }));
      return data;
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao iniciar sessão');
      return null;
    }
  }, []);

  const submitCompany = useCallback(
    async (data: CompanyFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        await setupService.submitCompany(state.sessionId, data);
        advance('admin', { company: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar dados da empresa');
      }
    },
    [state.sessionId]
  );

  const submitAdmin = useCallback(
    async (data: AdminFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        await setupService.submitAdmin(state.sessionId, data);
        advance('database', { admin: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar administrador');
      }
    },
    [state.sessionId]
  );

  const submitDatabase = useCallback(
    async (data: DatabaseFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        await setupService.submitDatabase(state.sessionId, data);
        advance('connector', { database: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar banco de dados');
      }
    },
    [state.sessionId]
  );

  const submitConnector = useCallback(
    async (data: ConnectorFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        await setupService.submitConnector(state.sessionId, data);
        advance('agent', { connector: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar connector');
      }
    },
    [state.sessionId]
  );

  const submitAgent = useCallback(
    async (data: AgentFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        advance('secrets', { agent: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar agent');
      }
    },
    [state.sessionId]
  );

  const submitSecrets = useCallback(
    async (data: SecretsFormData) => {
      if (!state.sessionId) return;
      setLoading(true);
      try {
        await setupService.submitSecrets(state.sessionId, data);
        advance('provision', { secrets: data });
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao salvar secrets');
      }
    },
    [state.sessionId]
  );

  const runProvision = useCallback(async () => {
    if (!state.sessionId) return;
    setLoading(true);
    try {
      const agent = state.agent ?? { name: 'atlas-agent-01', type: 'connector' };
      const result: ProvisionResponse = await setupService.runProvision(state.sessionId, agent);
      setState((s) => ({
        ...s,
        provisionResult: result,
        loading: false,
        error: null,
      }));
      return result;
    } catch (e: any) {
      setError(e?.message ?? 'Erro no provisionamento');
      return null;
    }
  }, [state.sessionId, state.agent]);

  const finishSetup = useCallback(async () => {
    if (!state.sessionId) return;
    setLoading(true);
    try {
      const result: FinishResponse = await setupService.finishSetup(state.sessionId);
      advance('finish', { finishResult: result });
      return result;
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao finalizar setup');
      return null;
    }
  }, [state.sessionId]);

  const setStep = useCallback((step: SetupStep) => {
    setState((s) => ({ ...s, step, error: null }));
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return {
    state,
    startSession,
    submitCompany,
    submitAdmin,
    submitDatabase,
    submitConnector,
    submitAgent,
    submitSecrets,
    runProvision,
    finishSetup,
    setStep,
    reset,
  };
}
