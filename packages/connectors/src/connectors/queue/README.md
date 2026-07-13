# @seltriva/connectors/connectors/queue

Message Queue Connector interfaces — reliable async messaging via RabbitMQ, Kafka, and Redis Streams.

## Supported Brokers

| Connector               | Subtype         | Broker        | Protocol            |
| ----------------------- | --------------- | ------------- | ------------------- |
| `RabbitMQConnector`     | `rabbitmq`      | RabbitMQ      | AMQP 0-9-1          |
| `KafkaConnector`        | `kafka`         | Apache Kafka  | Kafka Wire Protocol |
| `RedisStreamsConnector` | `redis-streams` | Redis Streams | RESP3               |

## Interface Hierarchy

```
Connector (universal base)
  └─ QueueConnector
       ├─ RabbitMQConnector   (exchanges, queues, bindings, routing)
       ├─ KafkaConnector      (topics, partitions, consumer groups, offsets)
       └─ RedisStreamsConnector (XADD, XREAD, XREADGROUP, XCLAIM, XTRIM)
```

## Common Pattern (all queue connectors)

```typescript
const queue: QueueConnector = ...;

// Publish
const receipt = await queue.publish('orders', {
  body: { orderId: 123, status: 'created' },
  contentType: 'application/json',
  correlationId: 'req-abc',
});

// Subscribe
const sub = await queue.subscribe('orders', async (msg, ack) => {
  await processOrder(msg.body);
  await ack.ack();
}, {
  consumerGroup: 'order-processor',
  prefetch: 10,
});

// Pause / resume
await sub.data!.pause();
await sub.data!.resume();
```

## RabbitMQ

```typescript
const rabbit: RabbitMQConnector = ...;

// Declare topology
await rabbit.assertExchange('orders', 'topic', { durable: true });
await rabbit.assertQueue('order-created', { durable: true, messageTtl: 86400000 });
await rabbit.bindQueue('order-created', 'orders', 'order.created.*');

// Dead-letter queue pattern
await rabbit.assertQueue('order-dlq', { durable: true });
await rabbit.assertQueue('order-created', {
  durable: true,
  deadLetterExchange: '',
  deadLetterRoutingKey: 'order-dlq',
});

// Publish to exchange with routing key
await rabbit.publish('orders', { body: payload }, {
  headers: { 'x-routing-key': 'order.created.retail' },
});
```

## Kafka

```typescript
const kafka: KafkaConnector = ...;

// Create topic with partitions
await kafka.createTopics([{ topic: 'orders', numPartitions: 6, replicationFactor: 3 }]);

// Consumer group subscription
await kafka.subscribe('orders', async (msg, ack) => {
  await processOrder(msg.body);
  await ack.ack();
}, {
  consumerGroup: 'order-processor',
  fromBeginning: false,
});

// Seek to timestamp for replay
const offsets = await kafka.seekToTimestamp('orders', new Date('2024-01-01'));

// Commit offsets manually
await kafka.commitOffsets([{ topic: 'orders', partition: 0, offset: '1234' }]);
```

## Redis Streams

```typescript
const redis: RedisStreamsConnector = ...;

// Append to stream
const id = await redis.xadd('orders', { orderId: '123', status: 'created' }, { maxLen: 10000 });

// Consumer group
await redis.xgroupCreate('orders', 'processor', '$', true);
const result = await redis.xreadGroup('processor', 'worker-1', ['orders'], { count: 10 });

// Ack processed messages
for (const { id } of result.data![0].entries) {
  await redis.xack('orders', 'processor', id);
}

// Claim stale pending messages (after consumer crash)
const pending = await redis.xclaim('orders', 'processor', 'worker-2', 30000, staleIds);
```

## Constraints

- No implementations in this module.
- `MessageAck.nack(requeue: false)` moves the message to the dead-letter destination (if configured).
- `KafkaConnector.subscribe()` manages the consumer group lifecycle; `consumerGroup` is required.
- `RedisStreamsConnector` maps `publish()` to `XADD` and `subscribe()` to `XREADGROUP` with a poll loop.
- `Subscription.pause()` stops new message delivery without losing the consumer group membership.
