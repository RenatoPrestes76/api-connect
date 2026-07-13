import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyHash } from '../security/hash-verifier.js';
import { SignatureVerifier, TrustedKeyRegistry } from '../security/signature-verifier.js';
import { validateManifest, PluginManifestError } from './plugin-manifest.js';
import type { PluginManifest } from './plugin-manifest.js';
import type { Connector, ConnectorFactory } from '../interfaces/connector.js';
import type { ConnectorContext } from '../core/connector-context.js';

export interface LoadedPlugin {
  readonly manifest: PluginManifest;
  readonly connector: Connector;
}

export class PluginLoadError extends Error {
  constructor(
    public readonly pluginDir: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`Failed to load plugin at "${pluginDir}": ${message}`);
    this.name = 'PluginLoadError';
  }
}

export interface PluginLoaderOptions {
  /**
   * When true, the loader skips RSA signature verification.
   * Safe for development plugins (signature === "").
   * Never set to true in production.
   */
  skipSignatureVerification?: boolean;
}

/**
 * PluginLoader
 *
 * Flow for each plugin directory:
 *  1. Read and validate connector.json
 *  2. Read the entry .js file as a Buffer
 *  3. Verify SHA-256 hash matches manifest.hash
 *  4. Optionally verify RSA-PSS signature
 *  5. Dynamically import the module
 *  6. Call the default-export factory with the ConnectorContext
 *  7. Return LoadedPlugin
 */
export class PluginLoader {
  private readonly _sigVerifier: SignatureVerifier;

  constructor(
    private readonly _keyRegistry: TrustedKeyRegistry = new TrustedKeyRegistry(),
    private readonly _opts: PluginLoaderOptions = {}
  ) {
    this._sigVerifier = new SignatureVerifier(_keyRegistry);
  }

  get keyRegistry(): TrustedKeyRegistry {
    return this._keyRegistry;
  }

  /** Load a single plugin from a directory containing connector.json. */
  async load(pluginDir: string, context: ConnectorContext): Promise<LoadedPlugin> {
    const manifestPath = path.join(pluginDir, 'connector.json');

    // 1. Read and validate manifest
    let manifest: PluginManifest;
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
      manifest = validateManifest(raw);
    } catch (err) {
      if (err instanceof PluginManifestError) throw new PluginLoadError(pluginDir, err.message);
      throw new PluginLoadError(
        pluginDir,
        `cannot read connector.json: ${(err as Error).message}`,
        err as Error
      );
    }

    // 2. Read entry file
    const entryPath = path.resolve(pluginDir, manifest.entry);
    let bundle: Buffer;
    try {
      bundle = fs.readFileSync(entryPath);
    } catch (err) {
      throw new PluginLoadError(
        pluginDir,
        `cannot read entry file "${manifest.entry}"`,
        err as Error
      );
    }

    // 3. Verify hash
    try {
      verifyHash(bundle, manifest.hash);
    } catch (err) {
      throw new PluginLoadError(
        pluginDir,
        `integrity check failed for "${manifest.entry}"`,
        err as Error
      );
    }

    // 4. Verify signature (skip in dev mode or when signature is empty)
    const skipSig = this._opts.skipSignatureVerification || !manifest.signature;
    if (!skipSig) {
      try {
        const valid = this._sigVerifier.verify(manifest.publicKeyId, bundle, manifest.signature);
        if (!valid) throw new PluginLoadError(pluginDir, 'RSA signature is invalid');
      } catch (err) {
        if (err instanceof PluginLoadError) throw err;
        throw new PluginLoadError(pluginDir, (err as Error).message, err as Error);
      }
    }

    // 5. Dynamically import the module
    const moduleUrl = pathToFileURL(entryPath).href;
    let mod: { default?: ConnectorFactory };
    try {
      mod = (await import(/* @vite-ignore */ moduleUrl)) as { default?: ConnectorFactory };
    } catch (err) {
      throw new PluginLoadError(
        pluginDir,
        `module import failed: ${(err as Error).message}`,
        err as Error
      );
    }

    if (typeof mod.default !== 'function') {
      throw new PluginLoadError(pluginDir, 'entry module must export a default factory function');
    }

    // 6. Instantiate connector
    let connector: Connector;
    try {
      connector = mod.default(context);
    } catch (err) {
      throw new PluginLoadError(
        pluginDir,
        `factory function threw: ${(err as Error).message}`,
        err as Error
      );
    }

    return { manifest, connector };
  }

  /**
   * Load all plugins found in immediate sub-directories of pluginsRoot.
   * `makeContext` receives the connector's ID (from its manifest) and returns a
   * ConnectorContext scoped to that connector.
   */
  async loadAll(
    pluginsRoot: string,
    makeContext: (connectorId: string) => ConnectorContext
  ): Promise<LoadedPlugin[]> {
    if (!fs.existsSync(pluginsRoot)) return [];

    const dirs = fs
      .readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((e: import('node:fs').Dirent) => e.isDirectory())
      .map((e: import('node:fs').Dirent) => path.join(pluginsRoot, e.name));

    const results: LoadedPlugin[] = [];
    for (const dir of dirs) {
      const manifestPath = path.join(dir, 'connector.json');
      if (!fs.existsSync(manifestPath)) continue;

      // Peek at the manifest to get the ID for context creation before full load
      let connectorId = path.basename(dir);
      try {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
        if (typeof raw['id'] === 'string') connectorId = raw['id'];
      } catch {
        /* fall back to dir name */
      }

      const plugin = await this.load(dir, makeContext(connectorId));
      results.push(plugin);
    }
    return results;
  }
}
