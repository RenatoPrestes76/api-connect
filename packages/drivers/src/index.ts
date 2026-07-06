/**
 * @seltriva/drivers
 * External service integrations and connectors
 */

export interface Driver {
  name: string;
  version: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// Placeholder for driver implementations
// TODO: Add specific drivers as needed
