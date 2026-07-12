import type { SBOM, SBOMComponent, SBOMComponentType } from './types.js';

function c(
  name: string,
  version: string,
  license: string,
  type: SBOMComponentType,
  vulnerabilities = 0
): SBOMComponent {
  const pkg = name.startsWith('@') ? name.slice(1).replace('/', '%2F') : name;
  return {
    name,
    version,
    license,
    type,
    purl: `pkg:npm/${pkg}@${version}`,
    vulnerabilities,
  };
}

const WORKSPACE_PACKAGES: SBOMComponent[] = [
  c('@seltriva/types', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/shared', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/logger', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/config', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/auth', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/database', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/runtime', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/plugin-sdk', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/cli', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/generator', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/testing', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/templates', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/validator', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/marketplace-api', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/sdk', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/connector-sdk', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/database-sdk', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/workflow-builder', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/billing', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/aegis', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/titan', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/release', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/atlasctl', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/ai', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/core', '1.0.0', 'MIT', 'runtime'),
  c('@seltriva/governance', '1.0.0', 'MIT', 'runtime'),
];

const RUNTIME_DEPS: SBOMComponent[] = [
  c('@prisma/client', '5.14.0', 'Apache-2.0', 'runtime'),
  c('@anthropic-ai/sdk', '0.24.0', 'MIT', 'runtime'),
  c('@xyflow/react', '12.0.0', 'MIT', 'runtime'),
  c('next', '15.0.0', 'MIT', 'runtime'),
  c('react', '19.0.0', 'MIT', 'runtime'),
  c('react-dom', '19.0.0', 'MIT', 'runtime'),
  c('@tanstack/react-query', '5.50.0', 'MIT', 'runtime'),
  c('zod', '3.23.0', 'MIT', 'runtime'),
  c('lucide-react', '0.400.0', 'ISC', 'runtime'),
  c('tailwindcss', '4.0.0', 'MIT', 'dev'),
  c('pg', '8.12.0', 'MIT', 'runtime'),
  c('mysql2', '3.10.0', 'MIT', 'runtime'),
  c('mssql', '11.0.0', 'MIT', 'runtime'),
  c('class-variance-authority', '0.7.0', 'Apache-2.0', 'runtime'),
];

const DEV_DEPS: SBOMComponent[] = [
  c('typescript', '5.4.5', 'Apache-2.0', 'dev'),
  c('vitest', '2.1.8', 'MIT', 'dev'),
  c('@vitest/coverage-v8', '2.1.8', 'MIT', 'dev'),
  c('eslint', '9.0.0', 'MIT', 'dev'),
  c('turbo', '2.0.0', 'MIT', 'dev'),
  c('prisma', '5.14.0', 'Apache-2.0', 'dev'),
  c('@types/node', '20.14.0', 'MIT', 'dev'),
  c('@types/react', '19.0.0', 'MIT', 'dev'),
  c('k6', '0.52.0', 'AGPL-3.0', 'dev'),
];

export function generateSBOM(version = '1.0.0'): SBOM {
  const components = [...WORKSPACE_PACKAGES, ...RUNTIME_DEPS, ...DEV_DEPS];
  const totalVulnerabilities = components.reduce((sum, c) => sum + c.vulnerabilities, 0);
  const licenses = [...new Set(components.map((c) => c.license))].sort();

  return {
    version,
    generatedAt: new Date().toISOString(),
    format: 'spdx-json',
    components,
    totalComponents: components.length,
    totalVulnerabilities,
    licenses,
  };
}

export function sbomByType(sbom: SBOM, type: SBOMComponentType): SBOMComponent[] {
  return sbom.components.filter((c) => c.type === type);
}

export function sbomVulnerableComponents(sbom: SBOM): SBOMComponent[] {
  return sbom.components.filter((c) => c.vulnerabilities > 0);
}
