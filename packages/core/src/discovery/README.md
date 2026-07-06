# @seltriva/core/discovery

Service, type, module, and driver discovery interfaces — runtime metadata resolution.

## Purpose

Enables dynamic discovery of running services, TypeScript class metadata (via decorators / `reflect-metadata`), workspace modules, and available driver implementations without hard-coded imports.

## Interfaces

| Interface | Role |
|-----------|------|
| `ServiceDiscovery` | Registers/resolves live service instances |
| `ServiceInstance` | A single registered service endpoint |
| `TypeDiscovery` | Reads TypeScript class/method metadata at runtime |
| `ClassMetadata` | Full reflection data for a class |
| `PropertyMetadata` | Per-property reflection data |
| `MethodMetadata` | Per-method reflection data (parameters, decorators) |
| `ParameterMetadata` | Per-parameter reflection data |
| `ModuleDiscovery` | Walks workspace packages and resolves dependency graph |
| `Module` | Descriptor for a single workspace module |
| `DiscoveryValidationResult` | Validation outcome for module/driver structure |
| `DriverDiscovery` | Scans filesystem for driver entry points |
| `DriverDescriptor` | Lightweight descriptor before a driver is loaded |

## Architecture

```
ServiceDiscovery  →  Consul / etcd / Kubernetes endpoints
TypeDiscovery     →  reflect-metadata (decorators)
ModuleDiscovery   →  package.json graph in pnpm workspace
DriverDiscovery   →  filesystem scan of packages/drivers/*
```

## Constraints

- No concrete implementations in this module.
- `TypeDiscovery` depends on `reflect-metadata` in the implementing package — not this module.
- `ServiceDiscovery.watch()` must not block the event loop.
