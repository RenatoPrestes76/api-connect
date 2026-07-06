/**
 * @seltriva/connectors/connectors/queue
 * Message Queue Connector interfaces — RabbitMQ, Kafka, Redis Streams
 */

import type { Connector, ConnectorConfig, ConnectorResult } from '../../core/index';

// ─── Base Queue Connector ─────────────────────────────────────────────────

/**
 * Shared base for all message queue connectors.
 * Models the abstract flow: Producers publish messages; Consumers subscribe.
 */
export interface QueueConnector extends Connector {
  readonly type: 'queue';

  /** Publish a message to a destination (queue, topic, exchange, stream) */
  publish(
    destination: string,
    message: QueueMessage,
    options?: PublishOptions
  ): Promise<ConnectorResult<PublishReceipt>>;

  /** Publish multiple messages in a batch */
  publishBatch(
    destination: string,
    messages: QueueMessage[],
    options?: PublishOptions
  ): Promise<ConnectorResult<PublishBatchResult>>;

  /** Subscribe to messages from a source */
  subscribe(
    source: string,
    handler: MessageHandler,
    options?: SubscribeOptions
  ): Promise<ConnectorResult<Subscription>>;

  /** Unsubscribe / cancel a subscription */
  unsubscribe(subscriptionId: string): Promise<ConnectorResult<void>>;

  /** Get queue or topic statistics */
  stats(destination: string): Promise<ConnectorResult<QueueStats>>;

  /** Purge all messages from a queue */
  purge(destination: string): Promise<ConnectorResult<PurgeResult>>;
}

// ─── Message Model ────────────────────────────────────────────────────────

export interface QueueMessage {
  readonly id?: string;
  readonly body: Buffer | string | Record<string, unknown>;
  readonly headers?: Record<string, string>;
  readonly contentType?: string;
  readonly correlationId?: string;
  readonly replyTo?: string;
  readonly timestamp?: Date;
  readonly expiration?: number;
  readonly priority?: number;
}

export interface ReceivedMessage extends QueueMessage {
  readonly id: string;
  readonly source: string;
  readonly receivedAt: Date;
  readonly deliveryCount: number;
  readonly redelivered: boolean;
  readonly rawOffset?: string | number;
}

// ─── Publish ──────────────────────────────────────────────────────────────

export interface PublishOptions {
  readonly persistent?: boolean;
  readonly mandatory?: boolean;
  readonly immediate?: boolean;
  readonly timeout?: number;
  readonly headers?: Record<string, string>;
}

export interface PublishReceipt {
  readonly messageId: string;
  readonly destination: string;
  readonly offset?: string | number;
  readonly partition?: number;
  readonly timestamp: Date;
}

export interface PublishBatchResult {
  readonly receipts: PublishReceipt[];
  readonly failed: Array<{ index: number; message: QueueMessage; error: string }>;
  readonly successCount: number;
  readonly failureCount: number;
}

// ─── Subscribe ────────────────────────────────────────────────────────────

export type MessageHandler = (message: ReceivedMessage, ack: MessageAck) => Promise<void>;

export interface MessageAck {
  ack(): Promise<void>;
  nack(requeue?: boolean): Promise<void>;
  reject(requeue?: boolean): Promise<void>;
}

export interface SubscribeOptions {
  readonly consumerGroup?: string;
  readonly consumerName?: string;
  readonly concurrency?: number;
  readonly prefetch?: number;
  readonly autoAck?: boolean;
  readonly fromBeginning?: boolean;
  readonly fromOffset?: string | number;
  readonly filter?: MessageFilter;
}

export interface MessageFilter {
  readonly headers?: Record<string, string>;
  readonly contentType?: string;
  readonly custom?: (message: ReceivedMessage) => boolean;
}

export interface Subscription {
  readonly id: string;
  readonly source: string;
  readonly consumerGroup?: string;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isActive(): boolean;
  onError(handler: (err: Error) => void): void;
}

// ─── Stats + Purge ────────────────────────────────────────────────────────

export interface QueueStats {
  readonly destination: string;
  readonly messageCount: number;
  readonly consumerCount: number;
  readonly inFlight?: number;
  readonly publishRate?: number;
  readonly consumeRate?: number;
  readonly oldestMessageAge?: number;
  readonly partitions?: number;
}

export interface PurgeResult {
  readonly messagesRemoved: number;
}

// ─── RabbitMQ Connector ───────────────────────────────────────────────────

export interface RabbitMQConnector extends QueueConnector {
  readonly subtype: 'rabbitmq';

  /** Declare a queue (idempotent) */
  assertQueue(name: string, options?: RabbitQueueOptions): Promise<ConnectorResult<RabbitQueueInfo>>;

  /** Declare an exchange */
  assertExchange(name: string, type: RabbitExchangeType, options?: RabbitExchangeOptions): Promise<ConnectorResult<void>>;

  /** Bind a queue to an exchange with a routing key */
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<ConnectorResult<void>>;

  /** Unbind a queue from an exchange */
  unbindQueue(queue: string, exchange: string, routingKey: string): Promise<ConnectorResult<void>>;

  /** Delete a queue */
  deleteQueue(name: string, options?: RabbitDeleteOptions): Promise<ConnectorResult<void>>;

  /** Delete an exchange */
  deleteExchange(name: string): Promise<ConnectorResult<void>>;

  /** Get a single message without subscribing (basic.get) */
  get(queue: string): Promise<ConnectorResult<ReceivedMessage | null>>;

  /** Check if a queue exists */
  queueExists(name: string): Promise<ConnectorResult<boolean>>;
}

export interface RabbitMQConnectorConfig extends ConnectorConfig {
  readonly url?: string;
  readonly hostname?: string;
  readonly port?: number;
  readonly username?: string;
  readonly password?: string;
  readonly vhost?: string;
  readonly tls?: boolean;
  readonly tlsCa?: string;
  readonly heartbeat?: number;
  readonly frameMax?: number;
  readonly channelMax?: number;
  readonly prefetch?: number;
}

export type RabbitExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

export interface RabbitQueueOptions {
  readonly durable?: boolean;
  readonly exclusive?: boolean;
  readonly autoDelete?: boolean;
  readonly messageTtl?: number;
  readonly expires?: number;
  readonly deadLetterExchange?: string;
  readonly deadLetterRoutingKey?: string;
  readonly maxLength?: number;
  readonly maxPriority?: number;
  readonly arguments?: Record<string, unknown>;
}

export interface RabbitExchangeOptions {
  readonly durable?: boolean;
  readonly autoDelete?: boolean;
  readonly internal?: boolean;
  readonly alternateExchange?: string;
  readonly arguments?: Record<string, unknown>;
}

export interface RabbitDeleteOptions {
  readonly ifUnused?: boolean;
  readonly ifEmpty?: boolean;
}

export interface RabbitQueueInfo {
  readonly name: string;
  readonly messageCount: number;
  readonly consumerCount: number;
}

// ─── Kafka Connector ──────────────────────────────────────────────────────

export interface KafkaConnector extends QueueConnector {
  readonly subtype: 'kafka';

  /** Create topics */
  createTopics(topics: KafkaTopicConfig[]): Promise<ConnectorResult<void>>;

  /** Delete topics */
  deleteTopics(names: string[]): Promise<ConnectorResult<void>>;

  /** List all topics */
  listTopics(): Promise<ConnectorResult<string[]>>;

  /** Get topic metadata (partitions, replicas, leaders) */
  describeTopics(names: string[]): Promise<ConnectorResult<KafkaTopicMetadata[]>>;

  /** Seek consumer group to a specific offset */
  seek(
    topic: string,
    partition: number,
    offset: string | number
  ): Promise<ConnectorResult<void>>;

  /** Seek consumer group to beginning or end */
  seekToTimestamp(
    topic: string,
    timestamp: Date
  ): Promise<ConnectorResult<Record<number, number>>>;

  /** Commit offsets manually */
  commitOffsets(offsets: KafkaTopicOffset[]): Promise<ConnectorResult<void>>;

  /** List committed offsets */
  fetchOffsets(topic: string): Promise<ConnectorResult<KafkaTopicOffset[]>>;

  /** Get cluster metadata */
  clusterMetadata(): Promise<ConnectorResult<KafkaClusterMetadata>>;
}

export interface KafkaConnectorConfig extends ConnectorConfig {
  readonly brokers: string[];
  readonly clientId?: string;
  readonly groupId?: string;
  readonly ssl?: boolean;
  readonly sasl?: KafkaSaslConfig;
  readonly connectionTimeout?: number;
  readonly authenticationTimeout?: number;
  readonly reauthenticationThreshold?: number;
  readonly requestTimeout?: number;
  readonly sessionTimeout?: number;
  readonly rebalanceTimeout?: number;
  readonly heartbeatInterval?: number;
  readonly maxRetryTime?: number;
  readonly initialRetryTime?: number;
  readonly retries?: number;
}

export interface KafkaSaslConfig {
  readonly mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'oauthbearer';
  readonly username?: string;
  readonly password?: string;
  readonly oauthBearerProvider?: () => Promise<{ value: string }>;
}

export interface KafkaTopicConfig {
  readonly topic: string;
  readonly numPartitions?: number;
  readonly replicationFactor?: number;
  readonly configEntries?: Array<{ name: string; value: string }>;
}

export interface KafkaTopicMetadata {
  readonly name: string;
  readonly partitions: KafkaPartitionMetadata[];
}

export interface KafkaPartitionMetadata {
  readonly partitionId: number;
  readonly leader: number;
  readonly replicas: number[];
  readonly isr: number[];
}

export interface KafkaTopicOffset {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly metadata?: string;
}

export interface KafkaClusterMetadata {
  readonly clusterId: string;
  readonly controller: number;
  readonly brokers: Array<{ nodeId: number; host: string; port: number }>;
}

// ─── Redis Streams Connector ──────────────────────────────────────────────

export interface RedisStreamsConnector extends QueueConnector {
  readonly subtype: 'redis-streams';

  /** Add entry to a stream (XADD) */
  xadd(
    stream: string,
    fields: Record<string, string>,
    options?: XAddOptions
  ): Promise<ConnectorResult<string>>;

  /** Read entries from a stream (XREAD) */
  xread(
    streams: string[],
    options?: XReadOptions
  ): Promise<ConnectorResult<XReadResult[]>>;

  /** Read from consumer group (XREADGROUP) */
  xreadGroup(
    group: string,
    consumer: string,
    streams: string[],
    options?: XReadGroupOptions
  ): Promise<ConnectorResult<XReadResult[]>>;

  /** Acknowledge a message (XACK) */
  xack(
    stream: string,
    group: string,
    ...ids: string[]
  ): Promise<ConnectorResult<number>>;

  /** Create a consumer group (XGROUP CREATE) */
  xgroupCreate(
    stream: string,
    group: string,
    startId?: string,
    mkstream?: boolean
  ): Promise<ConnectorResult<void>>;

  /** Delete a consumer group */
  xgroupDestroy(stream: string, group: string): Promise<ConnectorResult<void>>;

  /** Get stream info (XINFO STREAM) */
  xinfo(stream: string): Promise<ConnectorResult<XStreamInfo>>;

  /** Trim a stream (XTRIM) */
  xtrim(
    stream: string,
    strategy: 'MAXLEN' | 'MINID',
    threshold: number | string
  ): Promise<ConnectorResult<number>>;

  /** Claim pending messages from another consumer (XCLAIM) */
  xclaim(
    stream: string,
    group: string,
    consumer: string,
    minIdleMs: number,
    ids: string[]
  ): Promise<ConnectorResult<XStreamEntry[]>>;
}

export interface RedisStreamsConnectorConfig extends ConnectorConfig {
  readonly url?: string;
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly username?: string;
  readonly db?: number;
  readonly tls?: boolean;
  readonly keyPrefix?: string;
  readonly cluster?: boolean;
  readonly clusterNodes?: Array<{ host: string; port: number }>;
}

export interface XAddOptions {
  readonly id?: string;
  readonly maxLen?: number;
  readonly approximate?: boolean;
  readonly minId?: string;
}

export interface XReadOptions {
  readonly count?: number;
  readonly blockMs?: number;
  readonly ids?: Record<string, string>;
}

export interface XReadGroupOptions extends XReadOptions {
  readonly noAck?: boolean;
}

export interface XReadResult {
  readonly stream: string;
  readonly entries: XStreamEntry[];
}

export interface XStreamEntry {
  readonly id: string;
  readonly fields: Record<string, string>;
}

export interface XStreamInfo {
  readonly length: number;
  readonly radixTreeKeys: number;
  readonly radixTreeNodes: number;
  readonly lastGeneratedId: string;
  readonly firstEntry?: XStreamEntry;
  readonly lastEntry?: XStreamEntry;
  readonly groups?: XStreamGroupInfo[];
}

export interface XStreamGroupInfo {
  readonly name: string;
  readonly consumers: number;
  readonly pending: number;
  readonly lastDeliveredId: string;
}
