# @seltriva/connectors/connectors/database

Database Connector interfaces — Relational and Document databases.

## Supported Databases

| Connector             | Subtype      | Type       | Protocol         |
| --------------------- | ------------ | ---------- | ---------------- |
| `PostgreSQLConnector` | `postgresql` | Relational | TCP/SSL          |
| `SQLServerConnector`  | `sqlserver`  | Relational | TCP/TDS          |
| `OracleConnector`     | `oracle`     | Relational | TCP/Net8         |
| `FirebirdConnector`   | `firebird`   | Relational | TCP/FirebirdWire |
| `MySQLConnector`      | `mysql`      | Relational | TCP/MySQL        |
| `MariaDBConnector`    | `mariadb`    | Relational | TCP/MySQL        |
| `SQLiteConnector`     | `sqlite`     | Relational | File/In-memory   |
| `MongoDBConnector`    | `mongodb`    | Document   | TCP/MongoWire    |

## Interface Hierarchy

```
Connector (universal base)
  └─ DatabaseConnector
       ├─ RelationalConnector
       │    ├─ PostgreSQLConnector  (LISTEN/NOTIFY, COPY, Large Objects)
       │    ├─ SQLServerConnector   (Stored Procs, Linked Servers, BCP)
       │    ├─ OracleConnector      (PL/SQL, CLOBs, BLOBs, TNS)
       │    ├─ FirebirdConnector    (EXECUTE BLOCK, Generators)
       │    ├─ MySQLConnector       (Multi-query, LOAD DATA INFILE)
       │    └─ MariaDBConnector     (Galera Cluster, Spider Engine)
       │    └─ SQLiteConnector      (WAL, VACUUM, pragmas, in-memory)
       └─ MongoDBConnector          (CRUD, Aggregation, Change Streams)
```

## Base Operations (all databases)

```typescript
// Query
const result = await connector.query<User>('SELECT * FROM users WHERE active = $1', [true]);
result.data?.rows.forEach(user => console.log(user.name));

// Execute (no rows)
await connector.execute('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]);

// Transaction
const tx = await connector.beginTransaction();
try {
  await connector.execute('INSERT INTO orders ...', [...]);
  await connector.execute('UPDATE stock ...', [...]);
  await tx.data!.commit();
} catch {
  await tx.data!.rollback();
}
```

## PostgreSQL Specifics

```typescript
const pg: PostgreSQLConnector = ...;

// Realtime notifications
await pg.listen('order_updates', (payload) => console.log(payload));
await pg.notify('order_updates', JSON.stringify({ id: 123 }));

// High-performance COPY
await pg.copyFrom({ query: 'SELECT * FROM users', format: 'csv', header: true });
```

## SQL Server Specifics

```typescript
const mssql: SQLServerConnector = ...;
const result = await mssql.executeStoredProcedure('sp_get_orders', [
  { name: 'customerId', type: 'INT', value: 42 },
  { name: 'total', type: 'DECIMAL', value: null, direction: 'output' },
]);
console.log(result.data?.output.total);
```

## MongoDB Specifics

```typescript
const mongo: MongoDBConnector = ...;

// Aggregation pipeline
const result = await mongo.aggregate('orders', [
  { $match: { status: 'shipped' } },
  { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
]);

// Change streams (realtime)
const stream = await mongo.watch('orders', [{ $match: { operationType: 'insert' } }]);
stream.data!.on('change', (event) => console.log(event.fullDocument));
```

## Constraints

- No implementations in this module.
- All `ConnectorResult` methods follow the never-throw convention.
- `Transaction.isActive()` must return `false` after commit or rollback.
- `MongoCursor` must be closed after use to release server-side resources.
