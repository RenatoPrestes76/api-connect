/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `ProductionProvider` — the interface the rest of this automation
 * (`deploy.mjs`, `rollback.mjs`, `verify.mjs`) programs against, so a real
 * provider (Render, or whatever is chosen when a hosting account actually
 * exists) can be plugged in later without touching the orchestration
 * logic itself.
 *
 * `NullProvider` is the only implementation that ships today. It is not a
 * fake Render client — it does not simulate a deployment, does not
 * fabricate a URL, and does not pretend to succeed. Every method reports
 * `EXTERNAL/DEFERRED` honestly, because no provider credential exists in
 * this environment. Swap it for a real implementation (e.g.
 * `RenderProvider`) once a real account/API token exists — nothing else
 * in this automation needs to change.
 *
 * @typedef {'AVAILABLE'|'MISSING'|'INVALID'|'DEFERRED'|'PASS'|'FAIL'} ContractState
 *
 * @typedef {object} ProviderResult
 * @property {ContractState} state
 * @property {string} detail
 * @property {string} [url]
 */

/**
 * @interface
 * Implementations must never print or log a real credential value.
 */
export class ProductionProvider {
  /** @returns {Promise<ProviderResult>} Confirms the provider account/service/credential actually exists and is usable. */
  async validate() {
    throw new Error('ProductionProvider.validate() not implemented');
  }

  /** @returns {Promise<ProviderResult>} Triggers a real deployment of the current build/commit. Must not be called if validate() did not return PASS/AVAILABLE. */
  async deploy() {
    throw new Error('ProductionProvider.deploy() not implemented');
  }

  /** @returns {Promise<string|null>} The real, provider-assigned URL for the deployed service, or null if none exists. */
  async getDeploymentUrl() {
    throw new Error('ProductionProvider.getDeploymentUrl() not implemented');
  }

  /** @returns {Promise<ProviderResult>} The current deployment's real status, as reported by the provider. */
  async getDeploymentStatus() {
    throw new Error('ProductionProvider.getDeploymentStatus() not implemented');
  }

  /** @returns {Promise<ProviderResult>} Rolls back to the previous known-good deployment. Must not simulate — only act when a real provider mechanism exists. */
  async rollback() {
    throw new Error('ProductionProvider.rollback() not implemented');
  }
}

/**
 * The only implementation available until a real hosting account exists.
 * Every method is honest about that rather than throwing — callers can
 * treat a `NullProvider` result exactly like any other provider's
 * `EXTERNAL/DEFERRED` state.
 */
export class NullProvider extends ProductionProvider {
  async validate() {
    return {
      state: 'DEFERRED',
      detail:
        'No hosting provider is configured in this environment (no RENDER_* runtime env vars, no provider API credential). See docs/deployment/production-first-deployment.md.',
    };
  }

  async deploy() {
    return {
      state: 'DEFERRED',
      detail: 'Cannot deploy — no provider is configured. This was not simulated.',
    };
  }

  async getDeploymentUrl() {
    return null;
  }

  async getDeploymentStatus() {
    return { state: 'DEFERRED', detail: 'No deployment exists to report on.' };
  }

  async rollback() {
    return {
      state: 'DEFERRED',
      detail: 'Cannot roll back — no provider/deployment exists. This was not simulated.',
    };
  }
}

/**
 * Returns the active provider. Today this is always `NullProvider` — a
 * real provider is selected here (e.g. by inspecting `RENDER_SERVICE_ID`
 * or a `PRODUCTION_PROVIDER` env var) the moment one actually exists.
 * @returns {ProductionProvider}
 */
export function getActiveProvider() {
  return new NullProvider();
}
