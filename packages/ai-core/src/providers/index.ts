/**
 * @seltriva/ai-core/providers
 * AI Provider Abstraction — uniform interface over all LLM backends
 *
 * Base types (AIResult, AIError) live here because every module in ATHENA
 * ultimately routes through a provider. This is the foundation layer.
 *
 * Provider Pattern + Plugin Architecture: new providers are registered at
 * runtime without modifying existing code.
 *
 * Supported (by contract):
 *   OpenAI GPT-4o / GPT-4 / GPT-3.5
 *   Anthropic Claude (claude-sonnet-4-6, claude-opus-4-8, etc.)
 *   Google Gemini (gemini-1.5-pro, gemini-flash)
 *   Azure OpenAI (hosted OpenAI with enterprise contracts)
 *   DeepSeek
 *   Mistral
 *   Meta Llama (via API or local)
 *   Local models (Ollama, LM Studio, llama.cpp)
 */

// ─── Base Result Wrapper ──────────────────────────────────────────────────

/** Every ATHENA operation returns this — never throws */
export interface AIResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: AIError;
  readonly durationMs?: number;
  readonly tokenUsage?: TokenUsage;
  readonly timestamp: Date;
}

export interface AIError {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly providerId?: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

export type AIErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'CONTEXT_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'PARSE_FAILED'
  | 'SAFETY_BLOCKED'
  | 'MODEL_NOT_FOUND'
  | 'AGENT_ERROR'
  | 'DECISION_BLOCKED'
  | 'MEMORY_ERROR'
  | 'REASONING_FAILED'
  | 'UNKNOWN';

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cachedTokens?: number;
  readonly estimatedCostUsd?: number;
}

// ─── Branded IDs ──────────────────────────────────────────────────────────

export type AIProviderId = string & { readonly __brand: 'AIProviderId' };
export type AIModelId = string & { readonly __brand: 'AIModelId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type PromptId = string & { readonly __brand: 'PromptId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type RecommendationId = string & { readonly __brand: 'RecommendationId' };
export type DecisionId = string & { readonly __brand: 'DecisionId' };
export type MemoryEntryId = string & { readonly __brand: 'MemoryEntryId' };
export type FeedbackId = string & { readonly __brand: 'FeedbackId' };

// ─── Confidence ───────────────────────────────────────────────────────────

export type AIConfidenceValue = number;

export type AIConfidenceTier =
  | 'very-high' // 0.90–1.00
  | 'high' // 0.75–0.89
  | 'medium' // 0.55–0.74
  | 'low' // 0.35–0.54
  | 'very-low'; // 0.00–0.34

export function confidenceTier(value: AIConfidenceValue): AIConfidenceTier {
  if (value >= 0.9) return 'very-high';
  if (value >= 0.75) return 'high';
  if (value >= 0.55) return 'medium';
  if (value >= 0.35) return 'low';
  return 'very-low';
}

// ─── AI Provider Interface ────────────────────────────────────────────────

/**
 * The universal AI provider port.
 * Every concrete provider (OpenAI, Claude, Gemini…) implements this interface.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  readonly model: AIModelId;
  readonly capabilities: ProviderCapabilities;

  /** Send a completion request */
  complete(request: CompletionRequest): Promise<AIResult<CompletionResponse>>;

  /** Stream completion tokens */
  stream(request: CompletionRequest): AsyncIterable<CompletionChunk>;

  /** Generate an embedding vector for a text */
  embed(text: string, options?: EmbeddingOptions): Promise<AIResult<EmbeddingVector>>;

  /** Count tokens in a text without making a completion */
  countTokens(text: string): number;

  /** Check provider availability */
  isAvailable(): Promise<boolean>;

  /** Estimated cost for a request before sending */
  estimateCost(request: CompletionRequest): CostEstimate;
}

// ─── Provider Capabilities ────────────────────────────────────────────────

export interface ProviderCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsEmbeddings: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly supportsVision: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsSystemPrompt: boolean;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly supportedModalities: ProviderModality[];
}

export type ProviderModality = 'text' | 'image' | 'audio' | 'code' | 'embedding';

// ─── Completion Request / Response ───────────────────────────────────────

export interface CompletionRequest {
  readonly messages: AIMessage[];
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stop?: string[];
  readonly jsonMode?: boolean;
  readonly tools?: AITool[];
  readonly toolChoice?: ToolChoice;
  readonly seed?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface AIMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | AIMessageContent[];
  readonly toolCallId?: string;
  readonly name?: string;
}

export type AIMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; url: string; detail?: 'low' | 'high' | 'auto' };

export interface CompletionResponse {
  readonly id: string;
  readonly content: string;
  readonly finishReason: FinishReason;
  readonly toolCalls?: ToolCall[];
  readonly usage: TokenUsage;
  readonly model: string;
  readonly rawResponse?: Record<string, unknown>;
}

export interface CompletionChunk {
  readonly delta: string;
  readonly finishReason?: FinishReason;
  readonly usage?: Partial<TokenUsage>;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';

// ─── Tools (Function Calling) ─────────────────────────────────────────────

export interface AITool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export type ToolChoice = 'auto' | 'none' | 'required' | { readonly function: string };

// ─── Embeddings ───────────────────────────────────────────────────────────

export interface EmbeddingOptions {
  readonly dimensions?: number;
  readonly encoding?: string;
}

export interface EmbeddingVector {
  readonly values: readonly number[];
  readonly dimensions: number;
  readonly model: string;
}

// ─── Cost Estimation ──────────────────────────────────────────────────────

export interface CostEstimate {
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly estimatedTotalCostUsd: number;
  readonly pricingModel: string;
}

// ─── Provider Config ──────────────────────────────────────────────────────

export interface AIProviderConfig {
  readonly providerId: AIProviderId;
  readonly modelId: AIModelId;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly organization?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly rateLimitRpm?: number;
  readonly proxy?: string;
  readonly options?: Record<string, unknown>;
}

// ─── Known Provider IDs ───────────────────────────────────────────────────

export const PROVIDER_IDS = {
  OPENAI: 'provider-openai' as AIProviderId,
  ANTHROPIC: 'provider-anthropic' as AIProviderId,
  GOOGLE_GEMINI: 'provider-google-gemini' as AIProviderId,
  AZURE_OPENAI: 'provider-azure-openai' as AIProviderId,
  DEEPSEEK: 'provider-deepseek' as AIProviderId,
  MISTRAL: 'provider-mistral' as AIProviderId,
  LLAMA: 'provider-llama' as AIProviderId,
  LOCAL: 'provider-local' as AIProviderId,
} as const;

export type KnownProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

// ─── Known Model IDs ─────────────────────────────────────────────────────

export const MODEL_IDS = {
  // OpenAI
  GPT_4O: 'gpt-4o' as AIModelId,
  GPT_4O_MINI: 'gpt-4o-mini' as AIModelId,
  GPT_4_TURBO: 'gpt-4-turbo' as AIModelId,
  GPT_35_TURBO: 'gpt-3.5-turbo' as AIModelId,
  // Anthropic
  CLAUDE_SONNET_46: 'claude-sonnet-4-6' as AIModelId,
  CLAUDE_OPUS_48: 'claude-opus-4-8' as AIModelId,
  CLAUDE_HAIKU_45: 'claude-haiku-4-5-20251001' as AIModelId,
  // Google
  GEMINI_15_PRO: 'gemini-1.5-pro' as AIModelId,
  GEMINI_15_FLASH: 'gemini-1.5-flash' as AIModelId,
  GEMINI_20_FLASH: 'gemini-2.0-flash' as AIModelId,
  // DeepSeek
  DEEPSEEK_R1: 'deepseek-r1' as AIModelId,
  DEEPSEEK_CHAT: 'deepseek-chat' as AIModelId,
  // Mistral
  MISTRAL_LARGE: 'mistral-large-latest' as AIModelId,
  MISTRAL_SMALL: 'mistral-small-latest' as AIModelId,
  // Meta Llama
  LLAMA_31_70B: 'llama-3.1-70b-instruct' as AIModelId,
  LLAMA_31_8B: 'llama-3.1-8b-instruct' as AIModelId,
} as const;

// ─── Provider Registry ────────────────────────────────────────────────────

/**
 * Plugin-based provider registry — register providers at runtime.
 * Implementations may wrap any LLM SDK.
 */
export interface AIProviderRegistry {
  register(provider: AIProvider): void;
  unregister(providerId: AIProviderId): void;
  get(providerId: AIProviderId): AIProvider | null;
  getDefault(): AIProvider;
  setDefault(providerId: AIProviderId): void;
  getAll(): AIProvider[];
  getAvailable(): Promise<AIProvider[]>;
  has(providerId: AIProviderId): boolean;
}

// ─── Provider Factory ─────────────────────────────────────────────────────

/**
 * Creates provider instances from configuration.
 * Implementations instantiate the actual provider adapters.
 */
export interface AIProviderFactory {
  create(config: AIProviderConfig): AIResult<AIProvider>;
  supports(providerId: AIProviderId): boolean;
  getSupportedProviders(): AIProviderId[];
}

// ─── Provider Selector ────────────────────────────────────────────────────

/**
 * Selects the best provider for a given task based on capabilities,
 * cost, availability, and configured preferences.
 */
export interface AIProviderSelector {
  select(requirements: ProviderRequirements): AIProvider | null;
  selectAll(requirements: ProviderRequirements): AIProvider[];
}

export interface ProviderRequirements {
  readonly requiredCapabilities?: Array<keyof ProviderCapabilities>;
  readonly preferredProviderId?: AIProviderId;
  readonly maxCostPerRequestUsd?: number;
  readonly minContextTokens?: number;
  readonly taskType?: AITaskType;
}

export type AITaskType =
  | 'schema-analysis'
  | 'mapping-analysis'
  | 'erp-recognition'
  | 'sync-analysis'
  | 'security-analysis'
  | 'performance-analysis'
  | 'change-analysis'
  | 'validation'
  | 'embedding'
  | 'reasoning';
