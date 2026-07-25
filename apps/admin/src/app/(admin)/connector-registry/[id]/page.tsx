'use client';
import { useParams } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequirePermission } from '@/components/auth/require-permission';
import {
  useRegistryConnector,
  useRegistryVersions,
  usePublishRegistryVersion,
  useRegistryParameters,
  useCreateRegistryParameter,
  useDeleteRegistryParameter,
  useRegistryTemplates,
  useCreateRegistryTemplate,
  useDeleteRegistryTemplate,
  useValidateConnectorConfig,
} from '@/hooks/use-connector-registry';
import type {
  ConnectorVersionStatus,
  ParameterType,
  RegistryConnectorParameter,
} from '@/types/connector-registry';

type Tab = 'versions' | 'parameters' | 'templates' | 'validate';
const PARAM_TYPES: ParameterType[] = ['string', 'number', 'boolean', 'secret', 'enum', 'url'];

function ConnectorDetailContent(): ReactElement {
  const params = useParams<{ id: string }>();
  const connectorId = params.id;
  const [tab, setTab] = useState<Tab>('versions');

  const { data: connector, isLoading, error } = useRegistryConnector(connectorId);

  if (isLoading) return <PageLoading />;
  if (error || !connector) return <ErrorState message="Falha ao carregar conector" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={connector.name}
        description={`${connector.identifier} · ${connector.vendor} · ${connector.category}`}
        actions={
          <Badge variant={connector.status === 'active' ? 'success' : 'warning'}>
            {connector.status}
          </Badge>
        }
      />

      <div className="flex gap-1 border-b border-border">
        {(['versions', 'parameters', 'templates', 'validate'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'versions' && <VersionsTab connectorId={connectorId} />}
      {tab === 'parameters' && <ParametersTab connectorId={connectorId} />}
      {tab === 'templates' && <TemplatesTab connectorId={connectorId} />}
      {tab === 'validate' && <ValidateTab connectorId={connectorId} />}
    </div>
  );
}

function VersionsTab({ connectorId }: { connectorId: string }): ReactElement {
  const { data: versions, isLoading } = useRegistryVersions(connectorId);
  const publish = usePublishRegistryVersion();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    version: '',
    changelog: '',
    status: 'stable' as ConnectorVersionStatus,
    minRuntimeVersion: '1.0.0',
  });

  const handlePublish = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await publish.mutateAsync({ connectorId, input: form });
    setShowForm(false);
    setForm({ version: '', changelog: '', status: 'stable', minRuntimeVersion: '1.0.0' });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setShowForm(true)}>
        <Plus className="h-4 w-4" /> Publicar versão
      </Button>

      {showForm && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <form onSubmit={(e) => void handlePublish(e)} className="space-y-3">
              <Input
                placeholder="Versão (ex: 1.2.0)"
                required
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
              <Input
                placeholder="Changelog"
                required
                value={form.changelog}
                onChange={(e) => setForm({ ...form, changelog: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as ConnectorVersionStatus })
                  }
                  className="h-9 rounded border border-input bg-card px-3 text-sm text-foreground"
                >
                  <option value="stable">Estável</option>
                  <option value="beta">Beta</option>
                </select>
                <Input
                  placeholder="Compatibilidade mínima do Runtime"
                  required
                  value={form.minRuntimeVersion}
                  onChange={(e) => setForm({ ...form, minRuntimeVersion: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={publish.isPending}>
                  Publicar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(versions ?? []).map((v) => (
          <div key={v.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{v.version}</span>
              <Badge variant={v.status === 'stable' ? 'success' : 'warning'}>{v.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(v.publishedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{v.changelog}</p>
          </div>
        ))}
        {versions?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma versão publicada.
          </p>
        )}
      </div>
    </div>
  );
}

function ParametersTab({ connectorId }: { connectorId: string }): ReactElement {
  const { data: parameters, isLoading } = useRegistryParameters(connectorId);
  const create = useCreateRegistryParameter();
  const remove = useDeleteRegistryParameter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    key: '',
    label: '',
    type: 'string' as ParameterType,
    required: false,
    sensitive: false,
    options: '',
  });

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await create.mutateAsync({
      connectorId,
      input: {
        key: form.key,
        label: form.label,
        type: form.type,
        required: form.required,
        sensitive: form.sensitive,
        options: form.type === 'enum' ? form.options.split(',').map((o) => o.trim()) : undefined,
      },
    });
    setShowForm(false);
    setForm({ key: '', label: '', type: 'string', required: false, sensitive: false, options: '' });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setShowForm(true)}>
        <Plus className="h-4 w-4" /> Novo parâmetro
      </Button>

      {showForm && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Chave (ex: host)"
                  required
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                />
                <Input
                  placeholder="Rótulo (ex: Host)"
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ParameterType })}
                className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {form.type === 'enum' && (
                <Input
                  placeholder="Opções separadas por vírgula"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                />
              )}
              <div className="flex gap-4 text-sm text-foreground">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.required}
                    onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  />
                  Obrigatório
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.sensitive}
                    onChange={(e) => setForm({ ...form, sensitive: e.target.checked })}
                  />
                  Sensível (mascarado)
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={create.isPending}>
                  Criar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Chave', 'Rótulo', 'Tipo', 'Obrigatório', 'Sensível', ''].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(parameters ?? []).map((p: RegistryConnectorParameter) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-mono text-xs">{p.key}</td>
                <td className="px-3 py-2">{p.label}</td>
                <td className="px-3 py-2">{p.type}</td>
                <td className="px-3 py-2">{p.required ? 'Sim' : 'Não'}</td>
                <td className="px-3 py-2">{p.sensitive ? 'Sim' : 'Não'}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove.mutateAsync({ connectorId, parameterId: p.id })}
                  >
                    Excluir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {parameters?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum parâmetro definido.
          </p>
        )}
      </div>
    </div>
  );
}

function TemplatesTab({ connectorId }: { connectorId: string }): ReactElement {
  const { data: parameters } = useRegistryParameters(connectorId);
  const { data: templates, isLoading } = useRegistryTemplates(connectorId);
  const create = useCreateRegistryTemplate();
  const remove = useDeleteRegistryTemplate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);
    try {
      await create.mutateAsync({ connectorId, input: { name, values } });
      setShowForm(false);
      setName('');
      setValues({});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar template');
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setShowForm(true)}>
        <Plus className="h-4 w-4" /> Novo template
      </Button>

      {showForm && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
              {formError && <p className="text-sm text-danger">{formError}</p>}
              <Input
                placeholder="Nome do template"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {(parameters ?? []).map((p) => (
                <Input
                  key={p.key}
                  type={p.type === 'secret' ? 'password' : 'text'}
                  placeholder={p.label + (p.required ? ' *' : '')}
                  value={values[p.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                />
              ))}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={create.isPending}>
                  Criar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {t.name}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove.mutateAsync({ connectorId, templateId: t.id })}
                >
                  Excluir
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {Object.entries(t.values).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span>{k}</span>
                  <span className="font-mono">{String(v)}</span>
                </div>
              ))}
              {t.secretKeys.map((k) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span>{k}</span>
                  <span className="font-mono">••••••••</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {templates?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground sm:col-span-2">
            Nenhum template criado.
          </p>
        )}
      </div>
    </div>
  );
}

function ValidateTab({ connectorId }: { connectorId: string }): ReactElement {
  const { data: parameters } = useRegistryParameters(connectorId);
  const validate = useValidateConnectorConfig();
  const [values, setValues] = useState<Record<string, string>>({});

  const handleValidate = async (): Promise<void> => {
    await validate.mutateAsync({ id: connectorId, values });
  };

  return (
    <div className="max-w-lg space-y-3">
      <p className="text-sm text-muted-foreground">
        Testa a consistência da configuração (campos obrigatórios, tipos, formatos, dependências)
        sem conectar ao destino.
      </p>
      {(parameters ?? []).map((p) => (
        <Input
          key={p.key}
          type={p.type === 'secret' ? 'password' : 'text'}
          placeholder={p.label + (p.required ? ' *' : '')}
          value={values[p.key] ?? ''}
          onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
        />
      ))}
      <Button size="sm" onClick={() => void handleValidate()} loading={validate.isPending}>
        Validar
      </Button>

      {validate.data && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            validate.data.valid
              ? 'border-success/40 bg-success/10'
              : 'border-danger/40 bg-danger/10'
          }`}
        >
          {validate.data.valid ? (
            <p className="text-success">Configuração válida.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-danger">
              {validate.data.issues.map((issue) => (
                <li key={issue.key}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConnectorDetailPage(): ReactElement {
  return (
    <RequirePermission permission="connector-registry.read">
      <ConnectorDetailContent />
    </RequirePermission>
  );
}
