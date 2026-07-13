import type { ConfigStore } from '../configuration/config-store.js';
import type { CredentialStore } from '../credentials/credential-store.js';
import type { ConnectorLogger } from '../logging/connector-logger.js';
import type { EventBus } from '../events/event-bus.js';
import type { ConnectorScheduler } from '../scheduler/connector-scheduler.js';

/**
 * The runtime context injected into every connector by the ConnectorHost.
 * This is the only way a connector can access platform services —
 * it never imports the SDK directly; it receives this context at construction.
 */
export interface ConnectorContext {
  /** The connector's unique ID (matches ConnectorMetadata.id). */
  readonly connectorId: string;
  /** Read-only access to the connector's configuration. */
  readonly config: ConfigStore;
  /** Secure access to credentials (passwords, tokens, certificates). */
  readonly credentials: CredentialStore;
  /** Scoped logger — all entries are tagged with connectorId. */
  readonly logger: ConnectorLogger;
  /** Platform event bus — emit and subscribe to typed events. */
  readonly eventBus: EventBus;
  /** Register recurring jobs (health checks, syncs, discovery). */
  readonly scheduler: ConnectorScheduler;
}
