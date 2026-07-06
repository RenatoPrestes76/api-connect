/**
 * @seltriva/ai
 * AI/ML integrations and utilities
 */

export interface AIProvider {
  name: string;
  version: string;
  initialize(apiKey: string): Promise<void>;
}

// Placeholder for AI provider implementations
// TODO: Add LLM integrations as needed
