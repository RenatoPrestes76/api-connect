# @seltriva/core/constants

Platform-wide constant values — driver types, provider types, sync modes, event priorities, and registry scopes.

## Purpose

Provides a single source of truth for string/number literals used across modules. Import from here instead of inlining magic strings.

## Exported Constants

| Constant | Values |
|----------|--------|
| `CORE_MODULES` | `configuration`, `container`, `registry`, `event-bus`, `command-bus`, `plugin-manager`, `discovery` |
| `DRIVER_TYPES` | `database`, `erp`, `cache`, `storage`, `notification`, `auth`, `messaging` |
| `PROVIDER_TYPES` | `ai`, `authentication`, `storage`, `notification`, `payment` |
| `PLUGIN_LIFECYCLE` | `plugin:before-initialize` … `plugin:after-unload` |
| `EVENT_PRIORITIES` | `CRITICAL=100`, `HIGH=75`, `NORMAL=50`, `LOW=25`, `DEFERRED=0` |
| `SYNC_MODES` | `full`, `incremental`, `delta`, `batch`, `stream` |
| `MAPPING_TYPES` | `field`, `object`, `array`, `custom` |
| `REGISTRY_SCOPES` | `global`, `module`, `request` |

## Usage

```typescript
import { DRIVER_TYPES, EVENT_PRIORITIES } from '@seltriva/core/constants';

registry.getByType(DRIVER_TYPES.DATABASE);
eventBus.publish({ ..., priority: EVENT_PRIORITIES.HIGH });
```

## Constraints

- All constants are declared `as const` — values are readonly string/number literals.
- Do not add business-domain values here — this module is for infrastructure constants only.
