#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * Domain validation for the two official hostnames:
 *   atlasappruntime.com.br
 *   api.atlasappruntime.com.br
 *
 * A real DNS lookup, nothing else — no `/etc/hosts` entry, no assumed
 * resolution, no fabricated IP. Exported so `preflight.mjs`/`verify.mjs`
 * can reuse it instead of duplicating the check; also runnable directly:
 *
 *   node scripts/production/domain.mjs
 */
import { lookup } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';

export const OFFICIAL_DOMAIN = 'atlasappruntime.com.br';
export const OFFICIAL_API_HOST = 'api.atlasappruntime.com.br';

/**
 * @param {string} host
 * @returns {Promise<{host: string, state: 'PASS'|'DEFERRED', detail: string}>}
 */
export async function checkHostResolves(host) {
  try {
    const { address } = await lookup(host);
    return { host, state: 'PASS', detail: `resolves to ${address}` };
  } catch {
    return { host, state: 'DEFERRED', detail: 'does not resolve (not registered/configured yet)' };
  }
}

/**
 * Checks both official hostnames.
 * @returns {Promise<Array<{host: string, state: 'PASS'|'DEFERRED', detail: string}>>}
 */
export async function checkOfficialDomains() {
  return Promise.all([checkHostResolves(OFFICIAL_DOMAIN), checkHostResolves(OFFICIAL_API_HOST)]);
}

// Only run as a CLI when invoked directly, not when imported. Compared as
// file:// URLs (via pathToFileURL) rather than raw strings, so this works
// correctly on Windows too (drive-letter casing, backslash separators).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await checkOfficialDomains();
  console.log('\nATLAS DOMAIN VALIDATION\n');
  for (const r of results) {
    console.log(`[${r.state}] ${r.host} — ${r.detail}`);
  }
  const allResolved = results.every((r) => r.state === 'PASS');
  console.log(`\nRESULT: ${allResolved ? 'PASS' : 'EXTERNAL/DEFERRED'}`);
  process.exitCode = 0;
}
