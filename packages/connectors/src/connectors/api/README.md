# @seltriva/connectors/connectors/api

API Connector interfaces — REST, SOAP, GraphQL, gRPC, Webhook.

## Supported Protocols

| Connector          | Subtype   | Protocol          | Auth                                 |
| ------------------ | --------- | ----------------- | ------------------------------------ |
| `RESTConnector`    | `rest`    | HTTP/1.1, HTTP/2  | None, Basic, Bearer, API Key, OAuth2 |
| `SOAPConnector`    | `soap`    | HTTP + XML, WSDL  | WS-Security, NTLM, Basic             |
| `GraphQLConnector` | `graphql` | HTTP + WebSocket  | Bearer, API Key                      |
| `GRPCConnector`    | `grpc`    | HTTP/2 + Protobuf | Insecure, SSL, Token                 |
| `WebhookConnector` | `webhook` | Inbound HTTP      | HMAC Signature                       |

## Interface Hierarchy

```
Connector (universal base)
  └─ ApiConnector
       └─ HttpApiConnector   (GET/POST/PUT/PATCH/DELETE + shared HTTP primitives)
            ├─ RESTConnector    (upload, stream, paginate)
            ├─ SOAPConnector    (invoke, describeOperations, getWsdl)
            └─ GraphQLConnector (query, mutate, subscribe, introspect)
       └─ GRPCConnector         (unary, serverStream, clientStream, bidiStream)
       └─ WebhookConnector       (register, verifySignature, onEvent, replay)
```

## REST Usage

```typescript
const rest: RESTConnector = ...;

// Simple request
const result = await rest.get<User[]>('/users', { query: { active: true } });

// Pagination — automatically follows all pages
for await (const page of rest.paginate<Order>('/orders', {
  type: 'cursor',
  cursorPath: 'meta.nextCursor',
  cursorParam: 'after',
  itemsPath: 'data',
})) {
  processOrders(page);
}

// File upload
await rest.upload('/files', { filename: 'report.csv', content: buffer, contentType: 'text/csv' });
```

## SOAP Usage

```typescript
const soap: SOAPConnector = ...;

const ops = await soap.describeOperations();
const result = await soap.invoke<CustomerResponse>('GetCustomerById', {
  CustomerId: { _: 42 }
});
```

## GraphQL Usage

```typescript
const gql: GraphQLConnector = ...;

const result = await gql.query<{ users: User[] }>(`
  query GetUsers($limit: Int) {
    users(limit: $limit) { id name email }
  }
`, { limit: 10 });

const schema = await gql.introspect();
```

## gRPC Usage

```typescript
const grpc: GRPCConnector = ...;
await grpc.loadProto('./orders.proto');

// Unary
const order = await grpc.unaryCall<GetOrderReq, Order>('OrderService', 'GetOrder', { id: '123' });

// Server streaming
const stream = await grpc.serverStream('OrderService', 'WatchOrders', { customerId: '456' });
for await (const event of stream.data!) {
  console.log(event);
}
```

## Webhook Usage

```typescript
const webhook: WebhookConnector = ...;

// Register outbound webhook at remote service
await webhook.register({ url: 'https://my.app/hooks', events: ['order.created'] });

// Verify inbound event signature
const ok = webhook.verifySignature(rawBody, req.headers['x-signature']);

// Handle incoming events
webhook.onEvent('order.created', async (event) => {
  await processOrder(event.payload);
});
```

## Constraints

- No implementations in this module.
- `HttpApiConnector` uses `AbortSignal` for request cancellation.
- `GraphQLConnector.subscribe()` uses WebSocket transport — requires `wsEndpoint` in config.
- `WebhookConnector.verifySignature()` is synchronous (HMAC is CPU-bound, not I/O-bound).
- `RESTConnector.paginate()` is an `AsyncIterable` — callers control the iteration rate.
