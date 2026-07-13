/**
 * @seltriva/validator
 * Atlas Plugin Validator — validates plugins across 6 dimensions.
 *
 * Validation categories:
 *   manifest      — required fields, format, semver, SPDX license
 *   interfaces    — exported symbols match the declared plugin type
 *   compatibility — platform/SDK version ranges are satisfiable
 *   dependencies  — no forbidden modules, all peer deps satisfied
 *   security      — permissions match declared capabilities, no over-privilege
 *   performance   — startup time, memory footprint, bundle size
 *
 * @version 0.1.0
 */

import type { PluginManifest, PluginType } from '@seltriva/plugin-sdk';

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationReport {
  readonly pluginId: string;
  readonly version: string;
  readonly type: PluginType;
  readonly valid: boolean;
  readonly score: number; // 0–100
  readonly categories: CategoryReport[];
  readonly summary: ValidationSummary;
  readonly generatedAt: Date;
}

export interface CategoryReport {
  readonly category: ValidationCategory;
  readonly passed: boolean;
  readonly issues: ValidationIssue[];
  readonly issueCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

export interface ValidationIssue {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly category: ValidationCategory;
  readonly message: string;
  readonly path?: string;
  readonly value?: unknown;
  readonly hint?: string;
  readonly documentation?: string;
}

export interface ValidationSummary {
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly categoriesPassed: number;
  readonly categoriesFailed: number;
}

export type IssueSeverity = 'error' | 'warning' | 'info';
export type ValidationCategory =
  | 'manifest'
  | 'interfaces'
  | 'compatibility'
  | 'dependencies'
  | 'security'
  | 'performance';

// ─── Validator Interface ─────────────────────────────────────────────────────

export interface IPluginValidator {
  validate(target: ValidationTarget): Promise<ValidationReport>;
  validateManifest(manifest: PluginManifest): Promise<CategoryReport>;
  validateInterfaces(target: ValidationTarget): Promise<CategoryReport>;
  validateCompatibility(
    manifest: PluginManifest,
    env: PlatformEnvironment
  ): Promise<CategoryReport>;
  validateDependencies(target: ValidationTarget): Promise<CategoryReport>;
  validateSecurity(manifest: PluginManifest): Promise<CategoryReport>;
  validatePerformance(target: ValidationTarget): Promise<CategoryReport>;
}

export interface ValidationTarget {
  readonly manifest: PluginManifest;
  readonly packageDir: string;
  readonly builtEntryPoint: string;
  readonly packageJson: Record<string, unknown>;
  readonly sourceFiles?: string[];
}

export interface PlatformEnvironment {
  readonly platformVersion: string;
  readonly sdkVersion: string;
  readonly nodeVersion: string;
}

// ─── Manifest Validation Rules ───────────────────────────────────────────────

export const MANIFEST_RULES: ValidationRuleDefinition[] = [
  {
    code: 'MANIFEST_001',
    severity: 'error',
    message: 'Plugin ID must use reverse-domain format (e.g. com.vendor.plugin-name)',
    field: 'id',
    pattern: /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
  },
  {
    code: 'MANIFEST_002',
    severity: 'error',
    message: 'Version must follow semantic versioning (x.y.z)',
    field: 'version',
    pattern: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/,
  },
  {
    code: 'MANIFEST_003',
    severity: 'error',
    message: 'License must be a valid SPDX identifier',
    field: 'license',
    pattern: /^[A-Z][A-Za-z0-9\-+.]+$/,
  },
  {
    code: 'MANIFEST_004',
    severity: 'error',
    message: 'Plugin type must be one of the 12 supported types',
    field: 'type',
  },
  {
    code: 'MANIFEST_005',
    severity: 'error',
    message: 'platformVersion must be a valid semver range',
    field: 'platformVersion',
  },
  {
    code: 'MANIFEST_006',
    severity: 'error',
    message: 'sdkVersion must be a valid semver range',
    field: 'sdkVersion',
  },
  {
    code: 'MANIFEST_007',
    severity: 'error',
    message: 'entryPoint must be a relative path to the compiled JS entry file',
    field: 'entryPoint',
  },
  {
    code: 'MANIFEST_008',
    severity: 'error',
    message: 'runtime.nodeVersion must be a valid semver range (e.g. ">=20.0.0")',
    field: 'runtime.nodeVersion',
  },
  {
    code: 'MANIFEST_009',
    severity: 'warning',
    message: 'Plugin description should be at least 20 characters',
    field: 'description',
  },
  {
    code: 'MANIFEST_010',
    severity: 'warning',
    message: 'Plugin icon URL is recommended for marketplace visibility',
    field: 'icon',
  },
];

export interface ValidationRuleDefinition {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly field?: string;
  readonly pattern?: RegExp;
}

// ─── Security Rules ──────────────────────────────────────────────────────────

export const SECURITY_RULES: SecurityRule[] = [
  {
    code: 'SEC_001',
    severity: 'error',
    message: 'Permission "spawn:process" requires capability "process-spawn" to be declared',
    permission: 'spawn:process',
    requiredCapability: 'process-spawn',
  },
  {
    code: 'SEC_002',
    severity: 'error',
    message: 'Permission "write:credentials" requires capability "credential-access"',
    permission: 'write:credentials',
    requiredCapability: 'credential-access',
  },
  {
    code: 'SEC_003',
    severity: 'error',
    message: 'Permission "access:ai" requires capability "ai-inference"',
    permission: 'access:ai',
    requiredCapability: 'ai-inference',
  },
  {
    code: 'SEC_004',
    severity: 'warning',
    message:
      'Permission "spawn:process" is high-risk and requires justification in longDescription',
    permission: 'spawn:process',
    requiresJustification: true,
  },
  {
    code: 'SEC_005',
    severity: 'warning',
    message: 'Permission "write:credentials" should only be used by security-provider plugins',
    permission: 'write:credentials',
    restrictedToTypes: ['security-provider'],
  },
];

export interface SecurityRule {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly permission: string;
  readonly requiredCapability?: string;
  readonly requiresJustification?: boolean;
  readonly restrictedToTypes?: PluginType[];
}

// ─── Dependency Rules ────────────────────────────────────────────────────────

export const FORBIDDEN_DEPENDENCIES = [
  'eval',
  'Function',
  'child_process',
  '__dirname',
  'process.env',
  'fs.writeFileSync',
  'fs.unlinkSync',
  'require("http")',
  'require("net")',
] as const;

export const ALLOWED_NODE_BUILTINS = [
  'path',
  'url',
  'querystring',
  'crypto',
  'events',
  'stream',
  'util',
  'zlib',
  'buffer',
  'os',
] as const;

// ─── Performance Thresholds ──────────────────────────────────────────────────

export const PERFORMANCE_THRESHOLDS = {
  MAX_BUNDLE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  WARN_BUNDLE_SIZE_BYTES: 1 * 1024 * 1024, // 1 MB
  MAX_INIT_TIME_MS: 5_000,
  WARN_INIT_TIME_MS: 1_000,
  MAX_MEMORY_MB: 256,
  WARN_MEMORY_MB: 64,
  MAX_DEPENDENCIES: 50,
  WARN_DEPENDENCIES: 20,
} as const;

// ─── Validation Score Weights ────────────────────────────────────────────────

export const CATEGORY_WEIGHTS: Record<ValidationCategory, number> = {
  manifest: 30,
  interfaces: 25,
  compatibility: 15,
  dependencies: 10,
  security: 15,
  performance: 5,
} as const;
