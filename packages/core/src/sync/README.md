# @seltriva/core/sync

Data synchronization interfaces — orchestrates bidirectional data flows between ERP systems and the platform.

## Purpose

Defines the contracts for syncing data between external sources (ERP databases, APIs) and the Seltriva platform. Uses the Strategy Pattern so different sync modes (full, incremental, delta, streaming) are swappable without modifying the engine.

## Interfaces

| Interface           | Role                                                    |
| ------------------- | ------------------------------------------------------- |
| `SyncEngine`        | Orchestrates sync lifecycle and delegates to strategies |
| `SyncResult`        | Detailed outcome: counts, errors, timing                |
| `SyncError`         | Per-record failure detail                               |
| `SyncStatus`        | Live status of an active sync                           |
| `SyncHistory`       | Persisted audit log per source                          |
| `SyncStrategy`      | Strategy for one sync mode                              |
| `SyncContext`       | Runtime data injected into a strategy                   |
| `SyncSource`        | What to read from (driver + query)                      |
| `SyncTarget`        | Where to write to (driver + entity)                     |
| `SyncConfiguration` | Mode, batch size, conflict resolution settings          |
| `ConflictResolver`  | Resolves source/target conflicts per mode               |
| `ChangeDataCapture` | Streams database-level change events                    |
| `DataChange`        | Single CDC event (create/update/delete)                 |
| `FieldChange`       | Before/after value for one field                        |
| `SyncScheduler`     | Schedules periodic sync jobs via cron                   |
| `SyncJob`           | A single scheduled sync descriptor                      |

## Sync Modes

| Mode          | When to use                           |
| ------------- | ------------------------------------- |
| `full`        | Initial load or full reconciliation   |
| `incremental` | New records since last sync timestamp |
| `delta`       | Changed fields only                   |
| `batch`       | Bulk push in fixed-size chunks        |
| `stream`      | Real-time CDC via change events       |

## Constraints

- No concrete implementations in this module.
- `SyncContext.mapper` and `.logger` are typed as `unknown` to avoid circular imports — concrete implementations cast them.
- `ConflictResolver` strategies must be deterministic and idempotent.
