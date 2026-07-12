/**
 * @seltriva/connectors/connectors/api
 * API Connector interfaces — REST, SOAP, GraphQL, gRPC, Webhook
 */

import type { Connector, ConnectorConfig, ConnectorResult } from '../../core/index';

// ─── Base API Connector ───────────────────────────────────────────────────

/**
 * Shared base for all API connectors
 */
export interface ApiConnector extends Connector {
  readonly type: 'api';

  /** Set a header for all subsequent requests */
  setHeader(name: string, value: string): void;

  /** Remove a header */
  removeHeader(name: string): void;

  /** Get the current headers map */
  getHeaders(): Record<string, string>;

  /** Set a base URL path prefix */
  setBasePath(path: string): void;

  /** Get rate limit status */
  getRateLimitStatus(): RateLimitStatus | null;
}

export interface RateLimitStatus {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly retryAfterMs?: number;
}

// ─── HTTP Base ────────────────────────────────────────────────────────────

/**
 * Low-level HTTP primitives shared by REST, SOAP, and GraphQL
 */
export interface HttpApiConnector extends ApiConnector {
  get<TResponse = unknown>(
    path: string,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;

  post<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;

  put<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;

  patch<TResponse = unknown>(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;

  delete<TResponse = unknown>(
    path: string,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;

  /** Generic HTTP request for non-standard methods */
  request<TResponse = unknown>(
    method: string,
    path: string,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse<TResponse>>>;
}

export interface HttpRequestOptions {
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number | boolean>;
  readonly body?: unknown;
  readonly timeout?: number;
  readonly retries?: number;
  readonly signal?: AbortSignal;
  readonly responseType?: 'json' | 'text' | 'blob' | 'stream';
}

export interface HttpResponse<TData = unknown> {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: TData;
  readonly durationMs: number;
  readonly url: string;
  readonly redirected: boolean;
}

// ─── REST Connector ───────────────────────────────────────────────────────

export interface RESTConnector extends HttpApiConnector {
  readonly subtype: 'rest';

  /** Upload a file */
  upload(
    path: string,
    file: FileUpload,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<HttpResponse>>;

  /** Stream a response body */
  stream(
    path: string,
    options?: HttpRequestOptions
  ): Promise<ConnectorResult<AsyncIterable<Uint8Array>>>;

  /** Paginate through all pages of a paginated endpoint */
  paginate<TItem = unknown>(
    path: string,
    paginationStrategy: PaginationStrategy,
    options?: HttpRequestOptions
  ): AsyncIterable<TItem[]>;
}

export interface RESTConnectorConfig extends ConnectorConfig {
  readonly baseUrl: string;
  readonly authType?: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'custom';
  readonly bearerToken?: string;
  readonly apiKeyHeader?: string;
  readonly apiKeyValue?: string;
  readonly oauth2?: OAuth2Config;
  readonly defaultHeaders?: Record<string, string>;
  readonly defaultTimeout?: number;
  readonly followRedirects?: boolean;
  readonly maxRedirects?: number;
  readonly verifySsl?: boolean;
  readonly proxyUrl?: string;
}

export interface OAuth2Config {
  readonly grantType: 'client_credentials' | 'authorization_code' | 'password' | 'refresh_token';
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly scope?: string;
  readonly refreshToken?: string;
}

export interface FileUpload {
  readonly filename: string;
  readonly content: Buffer | Uint8Array;
  readonly contentType: string;
  readonly fieldName?: string;
}

export interface PaginationStrategy {
  readonly type: 'page' | 'cursor' | 'offset' | 'link-header' | 'custom';
  readonly pageParam?: string;
  readonly pageSizeParam?: string;
  readonly cursorParam?: string;
  readonly cursorPath?: string;
  readonly totalPath?: string;
  readonly itemsPath?: string;
  readonly nextLinkPath?: string;
  readonly pageSize?: number;
}

// ─── SOAP Connector ───────────────────────────────────────────────────────

export interface SOAPConnector extends HttpApiConnector {
  readonly subtype: 'soap';

  /** Invoke a WSDL-defined operation */
  invoke<TResponse = unknown>(
    operation: string,
    body: Record<string, unknown>,
    options?: SoapRequestOptions
  ): Promise<ConnectorResult<SoapResponse<TResponse>>>;

  /** Parse WSDL and return available operations */
  describeOperations(): Promise<ConnectorResult<SoapOperation[]>>;

  /** Get the parsed WSDL document */
  getWsdl(): Promise<ConnectorResult<Record<string, unknown>>>;
}

export interface SOAPConnectorConfig extends ConnectorConfig {
  readonly wsdlUrl: string;
  readonly endpoint?: string;
  readonly soapVersion?: '1.1' | '1.2';
  readonly namespaces?: Record<string, string>;
  readonly sslOptions?: { rejectUnauthorized?: boolean; ca?: string };
  readonly ntlm?: { username: string; password: string; domain?: string };
}

export interface SoapRequestOptions {
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly soapHeaders?: Record<string, unknown>;
}

export interface SoapResponse<TData = unknown> {
  readonly result: TData;
  readonly rawResponse: string;
  readonly header?: Record<string, unknown>;
  readonly durationMs: number;
}

export interface SoapOperation {
  readonly name: string;
  readonly input: SoapMessage;
  readonly output: SoapMessage;
  readonly faults?: SoapFault[];
  readonly documentation?: string;
}

export interface SoapMessage {
  readonly name: string;
  readonly parts: SoapPart[];
}

export interface SoapPart {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

export interface SoapFault {
  readonly name: string;
  readonly message: string;
}

// ─── GraphQL Connector ────────────────────────────────────────────────────

export interface GraphQLConnector extends HttpApiConnector {
  readonly subtype: 'graphql';

  /** Execute a GraphQL query */
  query<TData = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    options?: GraphQLRequestOptions
  ): Promise<ConnectorResult<GraphQLResponse<TData>>>;

  /** Execute a GraphQL mutation */
  mutate<TData = unknown>(
    mutation: string,
    variables?: Record<string, unknown>,
    options?: GraphQLRequestOptions
  ): Promise<ConnectorResult<GraphQLResponse<TData>>>;

  /** Subscribe to a GraphQL subscription (WebSocket) */
  subscribe<TData = unknown>(
    subscription: string,
    variables?: Record<string, unknown>
  ): Promise<ConnectorResult<GraphQLSubscription<TData>>>;

  /** Fetch and parse the introspection schema */
  introspect(): Promise<ConnectorResult<GraphQLSchema>>;
}

export interface GraphQLConnectorConfig extends ConnectorConfig {
  readonly endpoint: string;
  readonly wsEndpoint?: string;
  readonly authType?: 'none' | 'bearer' | 'apikey' | 'custom';
  readonly bearerToken?: string;
  readonly apiKeyHeader?: string;
  readonly apiKeyValue?: string;
  readonly defaultHeaders?: Record<string, string>;
  readonly timeout?: number;
}

export interface GraphQLRequestOptions {
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly operationName?: string;
}

export interface GraphQLResponse<TData = unknown> {
  readonly data?: TData;
  readonly errors?: GraphQLError[];
  readonly extensions?: Record<string, unknown>;
  readonly durationMs: number;
}

export interface GraphQLError {
  readonly message: string;
  readonly locations?: Array<{ line: number; column: number }>;
  readonly path?: (string | number)[];
  readonly extensions?: Record<string, unknown>;
}

export interface GraphQLSubscription<TData = unknown> {
  on(event: 'data', handler: (data: TData) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  on(event: 'complete', handler: () => void): void;
  unsubscribe(): void;
}

export interface GraphQLSchema {
  readonly types: GraphQLType[];
  readonly queryType: string;
  readonly mutationType?: string;
  readonly subscriptionType?: string;
  readonly directives: GraphQLDirective[];
}

export interface GraphQLType {
  readonly kind: 'OBJECT' | 'INPUT_OBJECT' | 'SCALAR' | 'ENUM' | 'INTERFACE' | 'UNION';
  readonly name: string;
  readonly fields?: GraphQLField[];
  readonly enumValues?: string[];
  readonly possibleTypes?: string[];
  readonly description?: string;
}

export interface GraphQLField {
  readonly name: string;
  readonly type: string;
  readonly args: GraphQLArg[];
  readonly isDeprecated: boolean;
  readonly deprecationReason?: string;
  readonly description?: string;
}

export interface GraphQLArg {
  readonly name: string;
  readonly type: string;
  readonly defaultValue?: unknown;
  readonly description?: string;
}

export interface GraphQLDirective {
  readonly name: string;
  readonly locations: string[];
  readonly args: GraphQLArg[];
  readonly description?: string;
}

// ─── gRPC Connector ───────────────────────────────────────────────────────

export interface GRPCConnector extends ApiConnector {
  readonly subtype: 'grpc';

  /** Unary call: one request, one response */
  unaryCall<TRequest, TResponse>(
    service: string,
    method: string,
    request: TRequest,
    options?: GRPCCallOptions
  ): Promise<ConnectorResult<TResponse>>;

  /** Server-streaming: one request, stream of responses */
  serverStream<TRequest, TResponse>(
    service: string,
    method: string,
    request: TRequest,
    options?: GRPCCallOptions
  ): Promise<ConnectorResult<AsyncIterable<TResponse>>>;

  /** Client-streaming: stream of requests, one response */
  clientStream<TRequest, TResponse>(
    service: string,
    method: string,
    options?: GRPCCallOptions
  ): Promise<ConnectorResult<GRPCClientStream<TRequest, TResponse>>>;

  /** Bidirectional streaming */
  bidiStream<TRequest, TResponse>(
    service: string,
    method: string,
    options?: GRPCCallOptions
  ): Promise<ConnectorResult<GRPCBidiStream<TRequest, TResponse>>>;

  /** Load and parse a proto definition */
  loadProto(protoPath: string): Promise<ConnectorResult<GRPCProtoDefinition>>;

  /** Reflect available services via gRPC reflection */
  reflect(): Promise<ConnectorResult<GRPCServiceDescriptor[]>>;
}

export interface GRPCConnectorConfig extends ConnectorConfig {
  readonly address: string;
  readonly protoPath?: string;
  readonly packageName?: string;
  /** Transport/auth mode — distinct from ConnectorConfig.credentials (the actual credential material). */
  readonly credentialsMode?: 'insecure' | 'ssl' | 'token';
  readonly sslCa?: string;
  readonly sslCert?: string;
  readonly sslKey?: string;
  readonly token?: string;
  readonly channelOptions?: Record<string, unknown>;
  readonly deadline?: number;
}

export interface GRPCCallOptions {
  readonly metadata?: Record<string, string>;
  readonly deadline?: number;
}

export interface GRPCClientStream<TRequest, TResponse> {
  write(request: TRequest): void;
  end(): Promise<TResponse>;
  on(event: 'error', handler: (err: Error) => void): void;
}

export interface GRPCBidiStream<TRequest, TResponse> {
  write(request: TRequest): void;
  end(): void;
  on(event: 'data', handler: (response: TResponse) => void): void;
  on(event: 'end', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
}

export interface GRPCProtoDefinition {
  readonly services: GRPCServiceDescriptor[];
  readonly messages: GRPCMessageDescriptor[];
}

export interface GRPCServiceDescriptor {
  readonly name: string;
  readonly fullName: string;
  readonly methods: GRPCMethodDescriptor[];
}

export interface GRPCMethodDescriptor {
  readonly name: string;
  readonly requestType: string;
  readonly responseType: string;
  readonly clientStreaming: boolean;
  readonly serverStreaming: boolean;
}

export interface GRPCMessageDescriptor {
  readonly name: string;
  readonly fullName: string;
  readonly fields: GRPCFieldDescriptor[];
}

export interface GRPCFieldDescriptor {
  readonly name: string;
  readonly type: string;
  readonly number: number;
  readonly repeated: boolean;
  readonly optional: boolean;
}

// ─── Webhook Connector ────────────────────────────────────────────────────

export interface WebhookConnector extends ApiConnector {
  readonly subtype: 'webhook';

  /** Register a webhook endpoint at the remote service */
  register(endpoint: WebhookEndpoint): Promise<ConnectorResult<WebhookRegistration>>;

  /** Unregister a webhook */
  unregister(webhookId: string): Promise<ConnectorResult<void>>;

  /** List all registered webhooks */
  list(): Promise<ConnectorResult<WebhookRegistration[]>>;

  /** Verify an incoming webhook signature */
  verifySignature(payload: Buffer, signature: string): ConnectorResult<boolean>;

  /** Subscribe to incoming webhook events in this process */
  onEvent(eventType: string, handler: WebhookEventHandler): string;

  /** Unsubscribe */
  offEvent(subscriptionId: string): void;

  /** Replay a previously received event */
  replay(deliveryId: string): Promise<ConnectorResult<void>>;
}

export interface WebhookConnectorConfig extends ConnectorConfig {
  readonly targetUrl: string;
  readonly secret?: string;
  readonly events?: string[];
  readonly signatureHeader?: string;
  readonly signatureAlgorithm?: 'sha256' | 'sha1' | string;
  readonly defaultHeaders?: Record<string, string>;
  readonly timeout?: number;
}

export interface WebhookEndpoint {
  readonly url: string;
  readonly events: string[];
  readonly secret?: string;
  readonly active?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface WebhookRegistration {
  readonly id: string;
  readonly url: string;
  readonly events: string[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly deliveryId: string;
  readonly receivedAt: Date;
  readonly source?: string;
}

export type WebhookEventHandler = (event: WebhookEvent) => Promise<void>;
