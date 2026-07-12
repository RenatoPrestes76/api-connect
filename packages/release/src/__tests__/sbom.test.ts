import { describe, it, expect } from 'vitest';
import { generateSBOM, sbomByType, sbomVulnerableComponents } from '../sbom.js';

describe('generateSBOM', () => {
  it('generates a valid SBOM for version 1.0.0', () => {
    const sbom = generateSBOM('1.0.0');
    expect(sbom.version).toBe('1.0.0');
    expect(sbom.format).toBe('spdx-json');
    expect(sbom.generatedAt).toBeTruthy();
  });

  it('totalComponents matches components array length', () => {
    const sbom = generateSBOM();
    expect(sbom.totalComponents).toBe(sbom.components.length);
  });

  it('has zero critical vulnerabilities', () => {
    const sbom = generateSBOM();
    expect(sbom.totalVulnerabilities).toBe(0);
  });

  it('includes all @seltriva workspace packages', () => {
    const sbom = generateSBOM();
    const names = sbom.components.map((c) => c.name);
    expect(names).toContain('@seltriva/titan');
    expect(names).toContain('@seltriva/aegis');
    expect(names).toContain('@seltriva/release');
    expect(names).toContain('@seltriva/billing');
  });

  it('includes runtime dependencies', () => {
    const sbom = generateSBOM();
    const names = sbom.components.map((c) => c.name);
    expect(names).toContain('@anthropic-ai/sdk');
    expect(names).toContain('next');
    expect(names).toContain('zod');
  });

  it('licenses array has no duplicates', () => {
    const sbom = generateSBOM();
    expect(new Set(sbom.licenses).size).toBe(sbom.licenses.length);
  });

  it('all components have a purl', () => {
    const sbom = generateSBOM();
    expect(sbom.components.every((c) => c.purl.startsWith('pkg:npm/'))).toBe(true);
  });
});

describe('sbomByType', () => {
  it('returns only runtime components', () => {
    const sbom = generateSBOM();
    const runtime = sbomByType(sbom, 'runtime');
    expect(runtime.every((c) => c.type === 'runtime')).toBe(true);
    expect(runtime.length).toBeGreaterThan(0);
  });

  it('returns only dev components', () => {
    const sbom = generateSBOM();
    const dev = sbomByType(sbom, 'dev');
    expect(dev.every((c) => c.type === 'dev')).toBe(true);
  });
});

describe('sbomVulnerableComponents', () => {
  it('returns empty array when no vulnerabilities', () => {
    const sbom = generateSBOM();
    expect(sbomVulnerableComponents(sbom)).toHaveLength(0);
  });
});
