/**
 * @seltriva/cli
 * Atlas CLI — developer toolchain for building and publishing Seltriva plugins.
 *
 * Commands: atlas create · build · package · publish · doctor · login · logout · test
 *
 * @version 0.1.0
 */

import type { PluginType } from '@seltriva/plugin-sdk';

// ─── CLI Context ────────────────────────────────────────────────────────────

export interface CLIContext {
  readonly cwd: string;
  readonly profile: string;
  readonly verbose: boolean;
  readonly noColor: boolean;
  readonly ciMode: boolean;
}

export interface CLIProfile {
  readonly name: string;
  readonly apiToken: string;
  readonly cloudUrl: string;
  readonly organizationId?: string;
  readonly createdAt: Date;
}

export interface CLICredentials {
  readonly token: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly userId: string;
  readonly email: string;
}

// ─── CLI Output ─────────────────────────────────────────────────────────────

export interface ICLIOutput {
  info(message: string, context?: Record<string, unknown>): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string, hint?: string): void;
  table(data: Array<Record<string, unknown>>, columns?: string[]): void;
  json(data: unknown): void;
  spinner(text: string): CLISpinner;
  prompt<T>(questions: CLIQuestion[]): Promise<T>;
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
  separator(): void;
  header(title: string): void;
  link(text: string, url: string): void;
}

export interface CLISpinner {
  update(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

export interface CLIQuestion {
  readonly name: string;
  readonly type: 'input' | 'password' | 'confirm' | 'list' | 'checkbox';
  readonly message: string;
  readonly choices?: Array<{ name: string; value: unknown }>;
  readonly default?: unknown;
  readonly validate?: (value: unknown) => boolean | string;
}

// ─── Command Base ────────────────────────────────────────────────────────────

export interface CLICommand<TArgs = void, TOptions = Record<string, never>> {
  readonly name: string;
  readonly description: string;
  readonly aliases?: string[];
  execute(args: TArgs, options: TOptions, context: CLIContext): Promise<CLICommandResult>;
}

export interface CLICommandResult {
  readonly exitCode: 0 | 1;
  readonly message?: string;
}

// ─── atlas create ────────────────────────────────────────────────────────────

export interface CreateCommandArgs {
  readonly pluginName: string;
}

export interface CreateCommandOptions {
  readonly type?: PluginType;
  readonly template?: string;
  readonly dir?: string;
  readonly yes?: boolean;
  readonly skipInstall?: boolean;
}

export interface CreateCommandResult {
  readonly pluginName: string;
  readonly type: PluginType;
  readonly outputDir: string;
  readonly filesCreated: string[];
  readonly nextSteps: string[];
}

// ─── atlas build ─────────────────────────────────────────────────────────────

export interface BuildCommandArgs {}

export interface BuildCommandOptions {
  readonly production?: boolean;
  readonly watch?: boolean;
  readonly outDir?: string;
  readonly sourcemaps?: boolean;
}

export interface BuildResult {
  readonly success: boolean;
  readonly outputDir: string;
  readonly entryPoints: string[];
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly warnings: string[];
  readonly errors: string[];
}

// ─── atlas package ───────────────────────────────────────────────────────────

export interface PackageCommandArgs {}

export interface PackageCommandOptions {
  readonly output?: string;
  readonly sign?: boolean;
  readonly keyFile?: string;
  readonly dryRun?: boolean;
}

export interface PackageResult {
  readonly packagePath: string;
  readonly manifest: unknown;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly signed: boolean;
  readonly signature?: string;
  readonly files: string[];
}

// ─── atlas publish ───────────────────────────────────────────────────────────

export interface PublishCommandArgs {}

export interface PublishCommandOptions {
  readonly channel?: 'stable' | 'beta' | 'edge';
  readonly tag?: string;
  readonly packageFile?: string;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export interface PublishResult {
  readonly pluginId: string;
  readonly version: string;
  readonly channel: string;
  readonly url: string;
  readonly publishedAt: Date;
}

// ─── atlas doctor ────────────────────────────────────────────────────────────

export interface DoctorCommandArgs {}

export interface DoctorCommandOptions {
  readonly fix?: boolean;
}

export interface DoctorReport {
  readonly canBuild: boolean;
  readonly canPublish: boolean;
  readonly checks: DoctorCheck[];
  readonly summary: DoctorSummary;
}

export interface DoctorCheck {
  readonly id: string;
  readonly name: string;
  readonly category: DoctorCheckCategory;
  readonly status: 'ok' | 'warning' | 'error' | 'skipped';
  readonly message?: string;
  readonly fixHint?: string;
  readonly fixable: boolean;
}

export interface DoctorSummary {
  readonly okCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
}

export type DoctorCheckCategory =
  | 'environment'
  | 'authentication'
  | 'project'
  | 'manifest'
  | 'dependencies'
  | 'build'
  | 'network';

export const DOCTOR_CHECK_IDS = {
  NODE_VERSION: 'dc-node-version',
  NPM_PNPM_INSTALLED: 'dc-pnpm-installed',
  ATLAS_AUTH: 'dc-atlas-auth',
  MANIFEST_EXISTS: 'dc-manifest-exists',
  MANIFEST_VALID: 'dc-manifest-valid',
  ENTRY_POINT_EXISTS: 'dc-entry-point-exists',
  DEPS_INSTALLED: 'dc-deps-installed',
  SDK_VERSION: 'dc-sdk-version',
  BUILD_OUTPUT: 'dc-build-output',
  NETWORK_CLOUD: 'dc-network-cloud',
  SIGNING_KEY: 'dc-signing-key',
  TS_CONFIG: 'dc-ts-config',
} as const;

// ─── atlas login ─────────────────────────────────────────────────────────────

export interface LoginCommandArgs {}

export interface LoginCommandOptions {
  readonly token?: string;
  readonly cloudUrl?: string;
  readonly profile?: string;
}

// ─── atlas logout ────────────────────────────────────────────────────────────

export interface LogoutCommandArgs {}

export interface LogoutCommandOptions {
  readonly profile?: string;
  readonly all?: boolean;
}

// ─── atlas test ──────────────────────────────────────────────────────────────

export interface TestCommandArgs {}

export interface TestCommandOptions {
  readonly coverage?: boolean;
  readonly watch?: boolean;
  readonly reporter?: 'default' | 'json' | 'junit';
  readonly filter?: string;
}

export interface TestRunResult {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly total: number;
  readonly durationMs: number;
  readonly coverage?: CoverageReport;
  readonly failures: TestFailure[];
}

export interface TestFailure {
  readonly suiteName: string;
  readonly testName: string;
  readonly error: string;
  readonly stack?: string;
}

export interface CoverageReport {
  readonly statements: number;
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
}

// ─── Project Config (.atlas.yaml) ────────────────────────────────────────────

export interface AtlasProjectConfig {
  readonly version: '1';
  readonly name: string;
  readonly type: PluginType;
  readonly src: string;
  readonly out: string;
  readonly build?: AtlasBuildConfig;
  readonly publish?: AtlasPublishConfig;
  readonly test?: AtlasTestConfig;
}

export interface AtlasBuildConfig {
  readonly target?: string;
  readonly minify?: boolean;
  readonly sourcemaps?: boolean;
  readonly external?: string[];
}

export interface AtlasPublishConfig {
  readonly channel?: 'stable' | 'beta' | 'edge';
  readonly tag?: string;
  readonly sign?: boolean;
  readonly keyFile?: string;
}

export interface AtlasTestConfig {
  readonly testDir?: string;
  readonly coverage?: boolean;
  readonly timeout?: number;
}

// ─── Config File Paths ───────────────────────────────────────────────────────

export const CLI_CONFIG_DIR = '.atlas';
export const CLI_PROJECT_FILE = 'atlas.yaml';
export const CLI_CREDENTIALS_FILE = '.atlas/credentials.json';
export const CLI_VERSION = '0.1.0';
