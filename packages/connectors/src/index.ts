/**
 * @seltriva/connectors
 * Universal Data Connector Framework (UDCF)
 *
 * Main export barrel — all public interfaces and constants.
 * Import sub-paths (e.g. @seltriva/connectors/database) for tree-shaking.
 */

// ─── Concrete Implementations ─────────────────────────────────────────────
export { RESTConnectorImpl, createRESTConnector, REST_CONNECTOR_DESCRIPTOR } from './connectors/rest/index.js';
export type { RESTRequestOptions, RESTResponse } from './connectors/rest/index.js';
export { inferSchema, schemaToMarkdown } from './connectors/rest/schema-inference.js';
export type { InferredSchema, InferredField } from './connectors/rest/schema-inference.js';

// ─── PostgreSQL Enterprise Connector ─────────────────────────────────────
// Non-conflicting value exports
export {
  createPostgreSQLConnector,
  POSTGRESQL_CONNECTOR_DESCRIPTOR,
  PostgreSQLConnectionManager,
  QueryRunner,
  CircuitBreaker,
  DEFAULT_QUERY_RUNNER_OPTIONS,
  SchemaDiscovery,
  TableStatisticsEngine,
  MetadataAggregator,
  ReadOnlyViolationError,
  QueryTimeoutError,
  CircuitOpenError,
  DiscoveryError,
  quoteIdent,
  qualifiedName,
} from './postgresql/index.js';

// Concrete class — aliased to avoid collision with the interface in ./connectors/database
export { PostgreSQLConnector as PgConnector } from './postgresql/index.js';

// Non-conflicting type exports
export type {
  SSLConfig,
  DiscoveryFilter,
  PrimaryKeyMetadata,
  MaterializedViewMetadata,
  EnumMetadata,
  ExtensionMetadata,
  TableStatistics,
  ColumnProfile,
  TableProfile,
  PostgreSQLIntrospectionReport,
  QueryRunnerOptions,
  CircuitBreakerOptions,
  SchemaName,
  TableName,
  ColumnName,
  IndexName,
  ConstraintName,
  SequenceName,
  ViewName,
} from './postgresql/index.js';

// PostgreSQL-specific types aliased to avoid collision with generic metadata interfaces
export type {
  PostgreSQLConnectorConfig   as PgConnectorConfig,
  SchemaMetadata              as PgSchemaMetadata,
  TableMetadata               as PgTableMetadata,
  ColumnMetadata              as PgColumnMetadata,
  IndexMetadata               as PgIndexMetadata,
  ForeignKeyMetadata          as PgForeignKeyMetadata,
  ViewMetadata                as PgViewMetadata,
  SequenceMetadata            as PgSequenceMetadata,
} from './postgresql/index.js';

// ─── Core ─────────────────────────────────────────────────────────────────

export type {
  Connector,
  ConnectorDescriptor,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorState,
  ConnectorType,
  ConnectorResult,
  ConnectorError,
  ConnectorErrorCode,
  DiscoveryOptions,
  DiscoveryResult,
  DiscoveredItem,
  MetadataTarget,
  ConnectorMetadata,
  ValidationReport,
  AuthResult,
  HealthReport,
} from './core/index';

// ─── Capabilities ─────────────────────────────────────────────────────────

export { CAPABILITIES } from './capabilities/index';
export type {
  Capability,
  CapabilityDescriptor,
  CapabilitySet,
  CapabilityRegistry,
  CapabilitySetBuilder,
  CapabilityNegotiator,
  CapabilityNegotiationReport,
} from './capabilities/index';

// ─── Metadata ─────────────────────────────────────────────────────────────

export type {
  MetadataEngine,
  SourceMetadata,
  DatabaseMetadata,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  IndexMetadata,
  IndexColumnMetadata,
  ConstraintMetadata,
  ForeignKeyMetadata,
  RelationshipMetadata,
  EntityMetadata,
  FieldMetadata,
  ViewMetadata,
  ProcedureMetadata,
  FunctionMetadata,
  TriggerMetadata,
  SequenceMetadata,
  ParameterMetadata,
  ApiEndpointMetadata,
  ApiParameterMetadata,
  ApiBodyMetadata,
  ApiResponseMetadata,
  ApiSecurityMetadata,
  FileStructureMetadata,
  MetadataDiff,
  EntityDiff,
  FieldDiff,
} from './metadata/index';

// ─── Discovery ────────────────────────────────────────────────────────────

export type {
  DiscoveryEngine,
  DiscoveryReport,
  DiscoveryTree,
  DiscoveryStats,
  DiscoveryQuery,
  DiscoverySearchResult,
  DiscoveryStrategy,
  RelationalDiscoveryEngine,
  DocumentDiscoveryEngine,
  ApiDiscoveryEngine,
  FileDiscoveryEngine,
  CloudDiscoveryEngine,
  QueueDiscoveryEngine,
} from './discovery/index';

// ─── Health ───────────────────────────────────────────────────────────────

export type {
  HealthEngine,
  HealthReport as ConnectorHealthReport,
  PingResult,
  ComponentHealthResult,
  HealthComponent,
  MonitoringOptions,
  HealthChangeEvent,
  LatencyMetrics,
  ConnectionStatus,
  AuthenticationStatus,
  PermissionStatus,
  VersionInfo,
  ServerInfo,
  HealthWarning,
  HealthWarningCode,
  ConnectorHealthRegistry,
} from './health/index';

// ─── Registry ─────────────────────────────────────────────────────────────

export type {
  ConnectorRegistry,
  ConnectorRegistryEntry,
  ConnectorRegistrationOptions,
  ConnectorSearchCriteria,
  RegistryChangeEvent,
  ConnectorConfigSchema,
  ConnectorConfigProperty,
  ConnectorInstanceRegistry,
  ConnectorRegistryManager,
} from './registry/index';

// ─── Factory ──────────────────────────────────────────────────────────────

export type {
  ConnectorFactory,
  ConnectorBuilder,
  ConnectorBuilderCredentials,
  PoolConfig,
  RetryConfig,
  SslConfig,
  ConnectorBuilderValidationResult,
  SerializedConnectorConfig,
  DatabaseConnectorFactory,
  ApiConnectorFactory,
  FileConnectorFactory,
  CloudConnectorFactory,
  QueueConnectorFactory,
  ConnectorFactoryRegistry,
  RelationalDatabaseType,
  DocumentDatabaseType,
} from './factory/index';

// ─── SDK ──────────────────────────────────────────────────────────────────

export { CONNECTOR_SDK_VERSION, getSdkVersionInfo } from './sdk/index';
export type {
  ConnectorPlugin,
  PluginAuthor,
  PluginLifecycle,
  PluginConfigValidationResult,
  PluginRegistry,
  PluginRegistryEvent,
  ConnectorManifest,
  PluginLoader,
  PluginValidationResult,
  PluginValidationError,
  PluginValidationErrorCode,
  PluginTestHarness,
  ComplianceReport,
  ComplianceTestResult,
  ConfigValidationTestResult,
  CapabilityExpectation,
  CapabilityTestResult,
  AbstractConnectorContract,
  SdkVersionInfo,
} from './sdk/index';

// ─── Database Connectors ──────────────────────────────────────────────────

export type {
  DatabaseConnector,
  QueryResult,
  QueryField,
  ExecuteResult,
  Transaction,
  TypeMap,
  RelationalConnector,
  PreparedStatement,
  BatchStatement,
  RelationalConnectorConfig,
  SslDatabaseConfig,
  DatabasePoolConfig,
  PostgreSQLConnector,
  PostgreSQLConnectorConfig,
  PostgreSQLCopySource,
  PostgreSQLCopyTarget,
  LargeObject,
  ReadableStreamLike,
  SQLServerConnector,
  SQLServerConnectorConfig,
  SQLServerParam,
  StoredProcedureResult,
  OracleConnector,
  OracleConnectorConfig,
  OraclePLSQLResult,
  FirebirdConnector,
  FirebirdConnectorConfig,
  MySQLConnector,
  MySQLConnectorConfig,
  MySQLLoadDataOptions,
  MariaDBConnector,
  MariaDBConnectorConfig,
  SQLiteConnector,
  SQLiteConnectorConfig,
  SQLiteCheckpointResult,
  MongoDBConnector,
  MongoDBConnectorConfig,
  MongoFilter,
  MongoUpdate,
  MongoAggregationStage,
  MongoFindOptions,
  MongoCursor,
  MongoInsertResult,
  MongoInsertManyResult,
  MongoUpdateResult,
  MongoDeleteResult,
  MongoChangeStream,
  MongoChangeEvent,
  MongoWatchOptions,
  MongoWriteConcern,
} from './connectors/database/index';

// ─── API Connectors ───────────────────────────────────────────────────────

export type {
  ApiConnector,
  RateLimitStatus,
  HttpApiConnector,
  HttpRequestOptions,
  HttpResponse,
  RESTConnector,
  RESTConnectorConfig,
  OAuth2Config,
  FileUpload,
  PaginationStrategy,
  SOAPConnector,
  SOAPConnectorConfig,
  SoapRequestOptions,
  SoapResponse,
  SoapOperation,
  SoapMessage,
  SoapPart,
  SoapFault,
  GraphQLConnector,
  GraphQLConnectorConfig,
  GraphQLRequestOptions,
  GraphQLResponse,
  GraphQLError,
  GraphQLSubscription,
  GraphQLSchema,
  GraphQLType,
  GraphQLField,
  GraphQLArg,
  GraphQLDirective,
  GRPCConnector,
  GRPCConnectorConfig,
  GRPCCallOptions,
  GRPCClientStream,
  GRPCBidiStream,
  GRPCProtoDefinition,
  GRPCServiceDescriptor,
  GRPCMethodDescriptor,
  GRPCMessageDescriptor,
  GRPCFieldDescriptor,
  WebhookConnector,
  WebhookConnectorConfig,
  WebhookEndpoint,
  WebhookRegistration,
  WebhookEvent,
  WebhookEventHandler,
} from './connectors/api/index';

// ─── File Connectors ──────────────────────────────────────────────────────

export type {
  FileConnector,
  FileSource,
  FileTarget,
  FileReadOptions,
  FileStreamOptions,
  FileWriteOptions,
  FileSchema,
  FileColumn,
  FileReadResult,
  FileWriteResult,
  FileValidationResult,
  FileValidationError,
  FileWarning,
  CSVConnector,
  CSVConnectorConfig,
  ExcelConnector,
  ExcelSheet,
  ExcelSheetData,
  ExcelColumnConfig,
  ExcelReadOptions,
  ExcelWriteOptions,
  XMLConnector,
  XMLReadOptions,
  XMLParseOptions,
  XMLSerializeOptions,
  XMLDocument,
  XMLNode,
  XMLDeclaration,
  XMLConnectorConfig,
  JSONConnector,
  JSONWriteOptions,
  JSONConnectorConfig,
  TXTConnector,
  TXTReadOptions,
  TXTReadResult,
  FixedWidthColumn,
  TXTWatcher,
  TXTConnectorConfig,
  ODSConnector,
  ODSSheet,
  ODSSheetData,
  ODSConnectorConfig,
} from './connectors/file/index';

// ─── Cloud Connectors ─────────────────────────────────────────────────────

export type {
  CloudStorageConnector,
  CloudContainer,
  CloudObjectMetadata,
  CloudObject,
  CloudObjectBody,
  CloudObjectPath,
  CloudObjectListing,
  ListObjectsOptions,
  ContainerOptions,
  ContainerEncryption,
  DeleteContainerOptions,
  PutObjectOptions,
  CopyObjectOptions,
  PresignedUrlOptions,
  PresignedUrl,
  DeleteObjectsResult,
  S3Connector,
  S3ConnectorConfig,
  S3MultipartUpload,
  S3Part,
  S3RestoreTier,
  S3ObjectVersion,
  S3LifecycleRule,
  S3LifecycleTransition,
  S3LifecycleExpiration,
  AzureBlobConnector,
  AzureBlobConnectorConfig,
  AzureBlobTier,
  AzureSasOptions,
  AzureBlobSnapshot,
  AzureCorsRule,
  GCSConnector,
  GCSConnectorConfig,
  GCSRewriteOptions,
  GCSSignUrlOptions,
  GCSLifecycleRule,
  SupabaseStorageConnector,
  SupabaseStorageConnectorConfig,
  SupabaseSignedUploadUrl,
  SupabaseBucketConfig,
} from './connectors/cloud/index';

// ─── Queue Connectors ─────────────────────────────────────────────────────

export type {
  QueueConnector,
  QueueMessage,
  ReceivedMessage,
  PublishOptions,
  PublishReceipt,
  PublishBatchResult,
  MessageHandler,
  MessageAck,
  SubscribeOptions,
  MessageFilter,
  Subscription,
  QueueStats,
  PurgeResult,
  RabbitMQConnector,
  RabbitMQConnectorConfig,
  RabbitExchangeType,
  RabbitQueueOptions,
  RabbitExchangeOptions,
  RabbitDeleteOptions,
  RabbitQueueInfo,
  KafkaConnector,
  KafkaConnectorConfig,
  KafkaSaslConfig,
  KafkaTopicConfig,
  KafkaTopicMetadata,
  KafkaPartitionMetadata,
  KafkaTopicOffset,
  KafkaClusterMetadata,
  RedisStreamsConnector,
  RedisStreamsConnectorConfig,
  XAddOptions,
  XReadOptions,
  XReadGroupOptions,
  XReadResult,
  XStreamEntry,
  XStreamInfo,
  XStreamGroupInfo,
} from './connectors/queue/index';
