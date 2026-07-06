# @seltriva/core/plugins

Plugin system interfaces — extends platform functionality without modifying core.

## Purpose

Enables third-party and first-party feature modules to integrate into Seltriva Connect through a stable plugin API. The `PluginManager` controls the full lifecycle; plugins interact with the platform only through `PluginContext`.

## Interfaces

| Interface | Role |
|-----------|------|
| `Plugin` | Core contract every plugin must implement |
| `PluginContext` | Runtime services injected at initialization |
| `PluginMetadata` | Immutable descriptor (id, version, capabilities) |
| `PluginManager` | Lifecycle orchestrator (register, enable, disable) |
| `PluginDependencyTree` | Graph node for dependency resolution |
| `PluginLoader` | Loads plugin modules dynamically from filesystem |
| `PluginHook` | Named extension point registered by a plugin |
| `PluginHookSystem` | Executes all hooks registered for a given name |
| `PluginLifecycleObserver` | Reacts to lifecycle state transitions |

## Lifecycle

```
load → initialize(context) → activate()
                           → deactivate() → unload
```

## Hook System

Plugins can extend each other's behavior without tight coupling:

```typescript
hookSystem.registerHook({
  name: 'sync:before-push',
  pluginId: 'my-plugin',
  callback: async (ctx) => { /* transform data */ },
  priority: 10,
});
```

## Constraints

- No concrete implementations in this module.
- Plugins must not import each other directly — use `PluginContext.pluginManager` or events.
- All lifecycle methods must be idempotent.
