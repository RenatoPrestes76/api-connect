'use client';
import { useEffect, useState } from 'react';
import { useEnvironments } from '@/hooks/use-portal';
import { useGatewaySettings, useUpdateGatewaySettings } from '@/hooks/use-gateway';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { LogLevel } from '@/types/gateway';

const LOG_LEVELS: LogLevel[] = ['minimal', 'standard', 'verbose'];

export default function GatewaySettingsPage() {
  const { data: envData, isLoading: envLoading, error: envError } = useEnvironments();
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const { data: settings, isLoading: settingsLoading } = useGatewaySettings(environmentId);
  const update = useUpdateGatewaySettings();

  const [corsOrigins, setCorsOrigins] = useState('');
  const [logLevel, setLogLevel] = useState<LogLevel>('standard');
  const [timeoutMs, setTimeoutMs] = useState('30000');
  const [internalBaseUrl, setInternalBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const environments = envData?.environments ?? [];

  useEffect(() => {
    if (!environmentId && environments[0]) {
      setEnvironmentId(environments[0].id);
    }
  }, [environmentId, environments]);

  useEffect(() => {
    if (!settings) return;
    setCorsOrigins(settings.corsAllowedOrigins.join(', '));
    setLogLevel(settings.logLevel);
    setTimeoutMs(String(settings.timeoutMs));
    setInternalBaseUrl(settings.internalBaseUrl ?? '');
  }, [settings]);

  if (envLoading) return <PageLoading />;
  if (envError) return <ErrorState message="Erro ao carregar ambientes" />;

  const handleSave = async () => {
    if (!environmentId) return;
    await update.mutateAsync({
      environmentId,
      patch: {
        corsAllowedOrigins: corsOrigins
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        logLevel,
        timeoutMs: Number(timeoutMs) || 30000,
        internalBaseUrl: internalBaseUrl || undefined,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Configuração do Gateway</h1>
        <p className="text-sm text-slate-400">Configurações independentes por ambiente</p>
      </div>

      <select
        value={environmentId ?? ''}
        onChange={(e) => setEnvironmentId(e.target.value)}
        className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name} ({env.kind})
          </option>
        ))}
      </select>

      {settingsLoading ? (
        <PageLoading />
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
          {saved && <p className="text-sm text-emerald-400">Configurações salvas.</p>}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500">
              Origens CORS permitidas (separadas por vírgula)
            </label>
            <input
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="https://app.example.com, https://admin.example.com"
              value={corsOrigins}
              onChange={(e) => setCorsOrigins(e.target.value)}
            />
            <p className="text-xs text-slate-600">
              Vazio = permite qualquer origem (padrão atual).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500">Nível de log</label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value as LogLevel)}
                className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              >
                {LOG_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500">Timeout (ms)</label>
              <input
                type="number"
                min={1000}
                className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500">
              URL interna (opcional)
            </label>
            <input
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="https://internal.example.svc.cluster.local"
              value={internalBaseUrl}
              onChange={(e) => setInternalBaseUrl(e.target.value)}
            />
          </div>

          <button
            onClick={() => void handleSave()}
            disabled={update.isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  );
}
