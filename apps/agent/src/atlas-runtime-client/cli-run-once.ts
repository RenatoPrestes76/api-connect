#!/usr/bin/env -S npx tsx
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * A thin CLI wrapper around `runAtlasRuntimeClient` (this module's own
 * orchestrator, unchanged — see run.ts's own header comment: "the same
 * module the real E2E test drives directly, no logic is duplicated
 * between real usage and test proof"). This file adds nothing but
 * env-var parsing and a JSON summary on stdout, so
 * `scripts/production/client-zero.mjs` can invoke a real Ed25519-signed
 * runtime enrollment without re-implementing any of the signing/protocol
 * logic that already exists here.
 *
 * Required env vars: ATLAS_BASE_URL, ATLAS_ORG_CODE, ATLAS_ACTIVATION_KEY
 * Optional: ATLAS_RUNTIME_DATA_DIR (defaults to a fresh temp dir)
 *
 * Prints exactly one JSON line on success; never prints the activation
 * key, private key, or any other secret.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAtlasRuntimeClient } from './run.js';

async function main(): Promise<void> {
  const apiUrl = process.env.ATLAS_BASE_URL;
  const organizationCode = process.env.ATLAS_ORG_CODE;
  const activationKey = process.env.ATLAS_ACTIVATION_KEY;

  if (!apiUrl || !organizationCode || !activationKey) {
    console.error(
      JSON.stringify({
        ok: false,
        error:
          'Missing required env var(s): ATLAS_BASE_URL, ATLAS_ORG_CODE, ATLAS_ACTIVATION_KEY are all required',
      })
    );
    process.exitCode = 1;
    return;
  }

  const dataDir = process.env.ATLAS_RUNTIME_DATA_DIR ?? mkdtempSync(join(tmpdir(), 'atlas-cz-'));

  try {
    const result = await runAtlasRuntimeClient({
      apiUrl,
      organizationCode,
      activationKey,
      dataDir,
      runtimeVersion: '1.0.0',
      hostname: 'atlas-client-zero-automation',
      os: process.platform,
      capabilities: [],
    });
    // Never the private key — only the runtime identity's public-facing id.
    console.log(
      JSON.stringify({
        ok: true,
        runtimeId: result.identity.runtimeId,
        registered: result.registered,
        heartbeatStatus: result.heartbeatStatus,
        jobsProcessed: result.jobsProcessed,
        jobsSucceeded: result.jobsSucceeded,
      })
    );
  } catch (err) {
    console.error(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) })
    );
    process.exitCode = 1;
  }
}

void main();
