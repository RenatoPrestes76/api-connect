import { randomUUID } from 'node:crypto';
import type {
  ConnectorRecord,
  ConnectorCategory,
  ConnectorStatus,
  ConnectorVersionRecord,
  ConnectorVersionStatus,
  ConnectorParameterRecord,
  ParameterType,
  ConnectorTemplateRecord,
  ConnectorTemplateDTO,
  ConfigValidationIssue,
} from './types.js';
import { encryptSecretValue } from './secret-crypto.js';
import { computeChecksum, signPackage } from './package-integrity.js';

const URL_PATTERN = /^https?:\/\/.+/i;

let _instance: ConnectorsStore | null = null;

export class ConnectorsStore {
  private connectors: ConnectorRecord[] = [];
  private versions: ConnectorVersionRecord[] = [];
  private parameters: ConnectorParameterRecord[] = [];
  private templates: ConnectorTemplateRecord[] = [];

  private constructor() {
    this.seed();
  }

  static getInstance(): ConnectorsStore {
    if (!_instance) _instance = new ConnectorsStore();
    return _instance;
  }

  // ─── Seed ───────────────────────────────────────────────────────────────

  private seed(): void {
    const postgres = this.createConnector({
      identifier: 'postgresql',
      name: 'PostgreSQL',
      category: 'DATABASE',
      vendor: 'PostgreSQL Global Development Group',
      description: 'Conector de banco de dados relacional PostgreSQL.',
      minRuntimeVersion: '1.0.0',
    });
    if (typeof postgres !== 'string') {
      this.publishVersion(postgres.id, {
        version: '1.0.0',
        changelog: 'Versão inicial.',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      });
      this.createParameter(postgres.id, {
        key: 'host',
        label: 'Host',
        type: 'string',
        required: true,
        sensitive: true,
        order: 0,
      });
      this.createParameter(postgres.id, {
        key: 'port',
        label: 'Porta',
        type: 'number',
        required: true,
        defaultValue: 5432,
        sensitive: false,
        order: 1,
      });
      this.createParameter(postgres.id, {
        key: 'database',
        label: 'Banco de dados',
        type: 'string',
        required: true,
        sensitive: false,
        order: 2,
      });
      this.createParameter(postgres.id, {
        key: 'username',
        label: 'Usuário',
        type: 'string',
        required: true,
        sensitive: true,
        order: 3,
      });
      this.createParameter(postgres.id, {
        key: 'password',
        label: 'Senha',
        type: 'secret',
        required: true,
        sensitive: true,
        order: 4,
      });
      this.createParameter(postgres.id, {
        key: 'ssl',
        label: 'SSL/TLS',
        type: 'boolean',
        required: false,
        defaultValue: false,
        sensitive: false,
        order: 5,
      });
      this.createParameter(postgres.id, {
        key: 'sslCertificate',
        label: 'Certificado SSL',
        type: 'secret',
        required: false,
        sensitive: true,
        order: 6,
        requiredIf: { key: 'ssl', equals: true },
      });
      this.createTemplate(postgres.id, {
        name: 'PostgreSQL padrão',
        description: 'Configuração local de desenvolvimento.',
        values: {
          host: 'localhost',
          port: 5432,
          database: 'postgres',
          username: 'postgres',
          password: 'postgres',
          ssl: false,
        },
      });
    }

    const rest = this.createConnector({
      identifier: 'rest-api',
      name: 'REST API Genérica',
      category: 'REST_API',
      vendor: 'Atlas Connect',
      description: 'Conector genérico para APIs REST autenticadas.',
      minRuntimeVersion: '1.0.0',
    });
    if (typeof rest !== 'string') {
      this.publishVersion(rest.id, {
        version: '1.0.0',
        changelog: 'Versão inicial.',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      });
      this.createParameter(rest.id, {
        key: 'baseUrl',
        label: 'URL base',
        type: 'url',
        required: true,
        sensitive: false,
        order: 0,
        validationPattern: URL_PATTERN.source,
      });
      this.createParameter(rest.id, {
        key: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        required: false,
        defaultValue: 30000,
        sensitive: false,
        order: 1,
      });
      this.createParameter(rest.id, {
        key: 'authType',
        label: 'Tipo de autenticação',
        type: 'enum',
        required: true,
        options: ['none', 'basic', 'bearer', 'api-key'],
        defaultValue: 'none',
        sensitive: false,
        order: 2,
      });
    }
  }

  // ─── Connectors ─────────────────────────────────────────────────────────

  listConnectors(
    filters: { category?: ConnectorCategory; status?: ConnectorStatus } = {}
  ): ConnectorRecord[] {
    let list = this.connectors.filter((c) => !c.deletedAt);
    if (filters.category) list = list.filter((c) => c.category === filters.category);
    if (filters.status) list = list.filter((c) => c.status === filters.status);
    return list;
  }

  getConnector(id: string): ConnectorRecord | undefined {
    return this.connectors.find((c) => c.id === id && !c.deletedAt);
  }

  getConnectorByIdentifier(identifier: string): ConnectorRecord | undefined {
    return this.connectors.find((c) => c.identifier === identifier && !c.deletedAt);
  }

  createConnector(input: {
    identifier: string;
    name: string;
    category: ConnectorCategory;
    vendor: string;
    description: string;
    icon?: string;
    minRuntimeVersion: string;
  }): ConnectorRecord | 'IDENTIFIER_TAKEN' {
    if (this.getConnectorByIdentifier(input.identifier)) return 'IDENTIFIER_TAKEN';
    const now = new Date().toISOString();
    const connector: ConnectorRecord = {
      id: randomUUID(),
      identifier: input.identifier,
      name: input.name,
      category: input.category,
      vendor: input.vendor,
      description: input.description,
      icon: input.icon,
      currentVersion: null,
      status: 'beta',
      minRuntimeVersion: input.minRuntimeVersion,
      createdAt: now,
      updatedAt: now,
    };
    this.connectors.push(connector);
    return connector;
  }

  /**
   * ATLAS 46.26 — final hardening, Part 8 (mass-assignment sweep):
   * Object.assign(connector, patch, {...}) copied every own, runtime
   * property of `patch` — the Pick<> below is a compile-time-only
   * restriction, erased by the route's `as Partial<CreateConnectorBody>`
   * cast (routes/v1/connector-registry/connectors.ts), so a body
   * containing e.g. `identifier` (documented as "Immutable after
   * creation") or `id` would have silently overwritten them. Fixed with
   * an explicit allowlist matching this method's own declared Pick<>.
   */
  updateConnector(
    id: string,
    patch: Partial<
      Pick<
        ConnectorRecord,
        'name' | 'vendor' | 'description' | 'icon' | 'category' | 'minRuntimeVersion'
      >
    >
  ): ConnectorRecord | null {
    const connector = this.getConnector(id);
    if (!connector) return null;
    const { name, vendor, description, icon, category, minRuntimeVersion } = patch;
    Object.assign(
      connector,
      {
        ...(name !== undefined ? { name } : {}),
        ...(vendor !== undefined ? { vendor } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(minRuntimeVersion !== undefined ? { minRuntimeVersion } : {}),
      },
      {
        id: connector.id,
        identifier: connector.identifier,
        createdAt: connector.createdAt,
        updatedAt: new Date().toISOString(),
      }
    );
    return connector;
  }

  setConnectorStatus(id: string, status: 'active' | 'deprecated'): ConnectorRecord | null {
    const connector = this.getConnector(id);
    if (!connector) return null;
    connector.status = status;
    connector.updatedAt = new Date().toISOString();
    return connector;
  }

  deleteConnector(id: string): boolean {
    const connector = this.getConnector(id);
    if (!connector) return false;
    connector.deletedAt = new Date().toISOString();
    return true;
  }

  // ─── Versions ───────────────────────────────────────────────────────────

  listVersions(connectorId: string): ConnectorVersionRecord[] {
    return this.versions
      .filter((v) => v.connectorId === connectorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  publishVersion(
    connectorId: string,
    input: {
      version: string;
      changelog: string;
      status: ConnectorVersionStatus;
      minRuntimeVersion: string;
      dependencies: string[];
    }
  ): ConnectorVersionRecord | null {
    const connector = this.getConnector(connectorId);
    if (!connector) return null;
    const now = new Date().toISOString();
    const checksum = computeChecksum({
      connectorId,
      version: input.version,
      changelog: input.changelog,
      dependencies: input.dependencies,
    });
    const record: ConnectorVersionRecord = {
      id: randomUUID(),
      connectorId,
      version: input.version,
      changelog: input.changelog,
      status: input.status,
      minRuntimeVersion: input.minRuntimeVersion,
      dependencies: input.dependencies,
      checksum,
      packageSignature: signPackage({ connectorId, version: input.version, checksum }),
      publishedAt: now,
      createdAt: now,
    };
    this.versions.push(record);

    if (input.status === 'stable') {
      connector.currentVersion = input.version;
      if (connector.status === 'beta') connector.status = 'active';
    }
    connector.updatedAt = now;

    return record;
  }

  // ─── Parameters ─────────────────────────────────────────────────────────

  listParameters(connectorId: string): ConnectorParameterRecord[] {
    return this.parameters
      .filter((p) => p.connectorId === connectorId)
      .sort((a, b) => a.order - b.order);
  }

  getParameter(connectorId: string, id: string): ConnectorParameterRecord | undefined {
    return this.parameters.find((p) => p.id === id && p.connectorId === connectorId);
  }

  createParameter(
    connectorId: string,
    input: {
      key: string;
      label: string;
      type: ParameterType;
      required: boolean;
      defaultValue?: string | number | boolean;
      validationPattern?: string;
      options?: string[];
      sensitive: boolean;
      description?: string;
      order: number;
      requiredIf?: { key: string; equals: string | number | boolean };
    }
  ): ConnectorParameterRecord {
    const now = new Date().toISOString();
    const parameter: ConnectorParameterRecord = {
      id: randomUUID(),
      connectorId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.parameters.push(parameter);
    return parameter;
  }

  updateParameter(
    connectorId: string,
    id: string,
    patch: Partial<
      Pick<
        ConnectorParameterRecord,
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
  ): ConnectorParameterRecord | null {
    const parameter = this.getParameter(connectorId, id);
    if (!parameter) return null;
    // ATLAS 46.26 — final hardening, Part 8: same class of fix as
    // updateConnector() above — `id`/`connectorId` (the parent link) must
    // never move via a PATCH body, regardless of what the route's type
    // cast claims is present.
    const {
      label,
      required,
      defaultValue,
      validationPattern,
      options,
      sensitive,
      description,
      order,
    } = patch;
    Object.assign(
      parameter,
      {
        ...(label !== undefined ? { label } : {}),
        ...(required !== undefined ? { required } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(validationPattern !== undefined ? { validationPattern } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(sensitive !== undefined ? { sensitive } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(order !== undefined ? { order } : {}),
      },
      {
        id: parameter.id,
        connectorId: parameter.connectorId,
        createdAt: parameter.createdAt,
        updatedAt: new Date().toISOString(),
      }
    );
    return parameter;
  }

  deleteParameter(connectorId: string, id: string): boolean {
    const idx = this.parameters.findIndex((p) => p.id === id && p.connectorId === connectorId);
    if (idx === -1) return false;
    this.parameters.splice(idx, 1);
    return true;
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  /** Structural validation only — never attempts to actually connect. */
  validateConfig(
    connectorId: string,
    values: Record<string, string | number | boolean | undefined>
  ): ConfigValidationIssue[] {
    const issues: ConfigValidationIssue[] = [];
    const parameters = this.listParameters(connectorId);

    for (const param of parameters) {
      const raw = values[param.key];
      const value = raw ?? param.defaultValue;

      let required = param.required;
      if (param.requiredIf) {
        const dependeeValue = values[param.requiredIf.key];
        required = required || dependeeValue === param.requiredIf.equals;
      }

      if (required && (value === undefined || value === null || value === '')) {
        issues.push({ key: param.key, message: `"${param.key}" é obrigatório` });
        continue;
      }
      if (value === undefined || value === null || value === '') continue;

      switch (param.type) {
        case 'number':
          if (typeof value !== 'number') {
            issues.push({ key: param.key, message: `"${param.key}" deve ser numérico` });
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            issues.push({ key: param.key, message: `"${param.key}" deve ser verdadeiro/falso` });
          }
          break;
        case 'enum':
          if (!param.options?.includes(String(value))) {
            issues.push({
              key: param.key,
              message: `"${param.key}" deve ser um de: ${param.options?.join(', ') ?? ''}`,
            });
          }
          break;
        case 'url':
          if (typeof value !== 'string' || !URL_PATTERN.test(value)) {
            issues.push({ key: param.key, message: `"${param.key}" deve ser uma URL válida` });
          }
          break;
        case 'string':
        case 'secret':
          if (typeof value !== 'string') {
            issues.push({ key: param.key, message: `"${param.key}" deve ser texto` });
          } else if (param.validationPattern && !new RegExp(param.validationPattern).test(value)) {
            issues.push({
              key: param.key,
              message: `"${param.key}" não corresponde ao formato esperado`,
            });
          }
          break;
      }
    }

    return issues;
  }

  // ─── Templates ──────────────────────────────────────────────────────────

  listTemplates(connectorId: string): ConnectorTemplateRecord[] {
    return this.templates.filter((t) => t.connectorId === connectorId);
  }

  getTemplate(connectorId: string, id: string): ConnectorTemplateRecord | undefined {
    return this.templates.find((t) => t.id === id && t.connectorId === connectorId);
  }

  createTemplate(
    connectorId: string,
    input: { name: string; description?: string; values: Record<string, string | number | boolean> }
  ): ConnectorTemplateRecord | ConfigValidationIssue[] {
    const issues = this.validateConfig(connectorId, input.values);
    if (issues.length > 0) return issues;

    const parameters = this.listParameters(connectorId);
    const publicValues: Record<string, string | number | boolean> = {};
    const encryptedValues: Record<string, string> = {};

    for (const [key, value] of Object.entries(input.values)) {
      const param = parameters.find((p) => p.key === key);
      if (param?.type === 'secret') {
        encryptedValues[key] = encryptSecretValue(String(value));
      } else {
        publicValues[key] = value;
      }
    }

    const now = new Date().toISOString();
    const template: ConnectorTemplateRecord = {
      id: randomUUID(),
      connectorId,
      name: input.name,
      description: input.description,
      values: publicValues,
      encryptedValues,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.push(template);
    return template;
  }

  deleteTemplate(connectorId: string, id: string): boolean {
    const idx = this.templates.findIndex((t) => t.id === id && t.connectorId === connectorId);
    if (idx === -1) return false;
    this.templates.splice(idx, 1);
    return true;
  }

  toTemplateDTO(template: ConnectorTemplateRecord): ConnectorTemplateDTO {
    return {
      id: template.id,
      connectorId: template.connectorId,
      name: template.name,
      description: template.description,
      values: template.values,
      secretKeys: Object.keys(template.encryptedValues),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export const connectorsStore = ConnectorsStore.getInstance();
