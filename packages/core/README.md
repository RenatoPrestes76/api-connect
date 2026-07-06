# @seltriva/core

Enterprise Core Architecture Foundation providing domain-driven design patterns, dependency injection, event-driven architecture, and extensibility framework.

## Overview

This package contains the architectural contracts and abstractions for Seltriva Connect's enterprise platform. It follows **Domain-Driven Design (DDD)**, **Hexagonal Architecture**, and **SOLID** principles to enable:

- Loose coupling between components
- Plugin-based extensibility
- Event-driven communication
- Command/Query separation (CQRS)
- Comprehensive error handling
- Configuration management
- Multiple integration patterns

**Important**: This package contains only **interfaces and contracts**. No implementations. All business logic lives in other packages.

## Module Structure

### Core Interfaces

#### 1. **Domain-Driven Design** (`interfaces/domain.ts`)
Core DDD tactical patterns.

- **ValueObject<T>** - Immutable objects identified by attributes
- **Entity<T>** - Uniquely identifiable objects
- **AggregateRoot<T>** - Aggregate cluster roots
- **DomainEvent** - Events representing domain changes
- **Repository<T>** - Persistence abstraction
- **UnitOfWork** - Transaction management
- **Specification<T>** - Query logic encapsulation
- **DomainService** - Stateless business operations

[📖 Domain Guide](./src/interfaces/README-domain.md)

#### 2. **Dependency Injection** (`interfaces/dependency-injection.ts`)
Service registration and resolution.

- **DIContainer** - Central dependency registry
- **DIRegistrationOptions** - Registration configuration
- **ServiceLocator** - Service discovery pattern

[📖 DI Guide](./src/interfaces/README-dependency-injection.md)

#### 3. **Event Bus** (`interfaces/event-bus.ts`)
Asynchronous event-driven architecture.

- **Event** - Immutable events
- **EventBus** - Publisher-subscriber coordination
- **EventListener** - Event handler registration
- **EventInterceptor** - Event processing middleware
- **EventReplayer** - Event sourcing support

[📖 Event Bus Guide](./src/interfaces/README-event-bus.md)

#### 4. **Command Bus** (`interfaces/command-bus.ts`)
CQRS command execution pattern.

- **Command** - Action requests
- **CommandBus** - Command dispatcher
- **CommandHandler** - Command execution
- **CommandValidator** - Pre-execution validation
- **CommandMiddleware** - Command processing pipeline

[📖 Command Bus Guide](./src/interfaces/README-command-bus.md)

#### 5. **Drivers** (`interfaces/driver.ts`)
External system integration abstractions.

- **Driver** - Base driver interface
- **DatabaseDriver** - SQL database access
- **ERPDriver** - ERP system integration
- **CacheDriver** - Caching backends
- **StorageDriver** - File/blob storage
- **NotificationDriver** - Multi-channel notifications

[📖 Driver Guide](./src/interfaces/README-driver.md)

#### 6. **Plugins** (`interfaces/plugin.ts`)
Dynamic plugin system for extensibility.

- **Plugin** - Plugin interface with lifecycle
- **PluginManager** - Plugin orchestration
- **PluginLoader** - Dynamic plugin loading
- **PluginHookSystem** - Extensibility hooks

[📖 Plugin Guide](./src/interfaces/README-plugin.md)

#### 7. **Configuration** (`interfaces/configuration.ts`)
Centralized configuration management.

- **ConfigurationManager** - Central config service
- **ConfigurationProvider** - Strategy pattern for sources
- **ConfigurationSchema** - Validation schemas

[📖 Configuration Guide](./src/interfaces/README-configuration.md)

#### 8. **Discovery** (`interfaces/discovery.ts`)
Service and type discovery with reflection.

- **ServiceDiscovery** - Service registration and lookup
- **TypeDiscovery** - Runtime type reflection
- **ModuleDiscovery** - Module scanning

[📖 Discovery Guide](./src/interfaces/README-discovery.md)

#### 9. **Mapping** (`interfaces/mapping.ts`)
Object transformation and mapping.

- **Mapper** - Object transformation engine
- **MappingDefinition** - Transformation configuration
- **SchemaMapper** - Schema-based transformation
- **TransformationPipeline** - Composable transformations

[📖 Mapping Guide](./src/interfaces/README-mapping.md)

#### 10. **Synchronization** (`interfaces/sync.ts`)
Data synchronization between systems.

- **SyncEngine** - Sync orchestration
- **SyncStrategy** - Sync mode strategies (full, incremental, delta, batch, stream)
- **ChangeDataCapture** - CDC for change tracking
- **ConflictResolver** - Conflict resolution strategies

[📖 Sync Guide](./src/interfaces/README-sync.md)

#### 11. **Registry** (`interfaces/registry.ts`)
Component registration and discovery.

- **Registry<T>** - Generic registry pattern
- **DriverRegistry** - Driver discovery
- **AIProviderRegistry** - AI provider registry
- **AuthenticationProviderRegistry** - Auth provider registry
- **StorageProviderRegistry** - Storage provider registry
- **NotificationProviderRegistry** - Notification provider registry
- **RegistryManager** - Central registry coordinator

[📖 Registry Guide](./src/interfaces/README-registry.md)

#### 12. **Design Patterns** (`interfaces/patterns.ts`)
Reusable design patterns.

- **Factory<T>** - Object creation
- **Strategy<T>** - Interchangeable algorithms
- **ChainHandler<T>** - Chain of responsibility
- **Observer<T>** - Observable/observer pattern
- **Decorator<T>** - Behavior enhancement
- **Adapter<T, U>** - Interface adaptation
- **Builder<T>** - Complex construction
- **Proxy<T>** - Operation interception

[📖 Patterns Guide](./src/interfaces/README-patterns.md)

#### 13. **Middleware** (`interfaces/middleware.ts`)
Request/response processing pipelines.

- **Middleware<TReq, TRes>** - Pipeline component
- **Pipeline<TReq, TRes>** - Middleware composition
- **Interceptor<T>** - Operation interception
- **InterceptorChain<T>** - Interceptor composition
- **ErrorMiddleware** - Error handling middleware

[📖 Middleware Guide](./src/interfaces/README-middleware.md)

### Supporting Files

#### Constants (`src/constants/index.ts`)
```typescript
// Module names
CORE_MODULES

// Driver and provider types
DRIVER_TYPES, PROVIDER_TYPES

// Lifecycle events
PLUGIN_LIFECYCLE

// Priorities and modes
EVENT_PRIORITIES, SYNC_MODES, MAPPING_TYPES, REGISTRY_SCOPES
```

#### Exceptions (`src/exceptions/index.ts`)
```typescript
// Typed exceptions for error handling
CoreException, ConfigurationException, DIException, RegistryException,
PluginException, EventBusException, CommandBusException, DiscoveryException,
DriverException, MappingException, SyncException
```

#### Public Exports (`src/index.ts`)
Central export point for all interfaces and types.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│           Application Services & Use Cases                   │
├─────────────────────────────────────────────────────────────┤
│                   Command Bus (CQRS)                         │
│  Commands → Validation → Handlers → Events → Response        │
├─────────────────────────────────────────────────────────────┤
│                    Event Bus (Async)                         │
│  Events → Routing → Handlers (async) → Propagation          │
├─────────────────────────────────────────────────────────────┤
│              Domain Layer (Business Logic)                    │
│  Aggregates → Events → Repositories → Domain Services       │
├─────────────────────────────────────────────────────────────┤
│            Infrastructure & External Systems                 │
│  ┌──────────────┬──────────────┬──────────────┐              │
│  │ DI Container │ Drivers      │ Plugins      │              │
│  │              │ (Database,   │ (Dynamic     │              │
│  │              │  ERP, Cache, │  Extension)  │              │
│  │              │  Storage)    │              │              │
│  └──────────────┴──────────────┴──────────────┘              │
├─────────────────────────────────────────────────────────────┤
│         Cross-Cutting Concerns                               │
│ Configuration │ Discovery │ Mapping │ Sync │ Middleware     │
└─────────────────────────────────────────────────────────────┘
```

## Relationships Between Modules

```
Domain
  ├─→ DI Container (dependency resolution)
  ├─→ Event Bus (publish domain events)
  ├─→ Repository (persistence)
  └─→ Domain Services

Command Bus
  ├─→ DI Container (handler resolution)
  ├─→ Validator (pre-execution checks)
  ├─→ Event Bus (publish command-generated events)
  └─→ Middleware (processing pipeline)

Event Bus
  ├─→ DI Container (handler resolution)
  ├─→ Interceptor (event processing)
  └─→ Plugins (event-driven extensibility)

Plugin System
  ├─→ DI Container (scoped dependencies)
  ├─→ Event Bus (lifecycle events)
  ├─→ Command Bus (plugin commands)
  └─→ Registry (plugin discovery)

Driver Registry
  ├─→ Drivers (database, ERP, storage, etc)
  ├─→ Configuration (driver config)
  └─→ Sync Engine (uses drivers)

Sync Engine
  ├─→ Drivers (source/target systems)
  ├─→ Mapper (data transformation)
  ├─→ Configuration (sync config)
  └─→ Event Bus (sync events)
```

## Usage Patterns

### Domain-Driven Design

```typescript
// Define aggregate root
class Order implements AggregateRoot<OrderData> {
  getUncommittedEvents(): DomainEvent[] {
    return this.events;
  }
  // ... other DDD methods
}

// Persist with repository
class OrderRepository implements Repository<Order> {
  async save(order: Order): Promise<void> {
    // Save order and all uncommitted events
  }
}
```

### Dependency Injection

```typescript
const container = new DIContainer();
container.registerSingleton('config', new ConfigurationManager());
container.registerTransient('context', () => new RequestContext());
const service = container.resolve<MyService>('myService');
```

### Event-Driven Architecture

```typescript
const eventBus = new EventBus();

eventBus.subscribe({
  eventType: 'OrderCreated',
  handler: async (event) => {
    // Process order
  },
  priority: 75
});

await eventBus.publish({
  type: 'OrderCreated',
  // ... event fields
});
```

### Command/Query Separation

```typescript
const commandBus = new CommandBus();

commandBus.register('CreateOrder', async (cmd) => {
  // Execute command, return result
  return { success: true, data: order };
});

const result = await commandBus.send(createOrderCommand);
```

### Plugin System

```typescript
class MyPlugin implements Plugin {
  async initialize(context: PluginContext): Promise<void> {
    // Register services in DI
    context.container.register('myService', () => new MyService());
    
    // Subscribe to events
    context.eventBus.subscribe({
      eventType: 'SomeEvent',
      handler: this.handleEvent
    });
  }
}
```

## Best Practices

### 1. Dependency Injection
- Use constructor injection, not service locator
- Register interfaces, not implementations
- Manage lifecycles appropriately (singleton vs transient)

### 2. Domain-Driven Design
- Keep aggregates small and focused
- Use value objects for attributes
- Publish domain events from aggregates
- Repositories are abstraction only

### 3. Event-Driven Architecture
- Events represent past tense (OrderCreated, PaymentProcessed)
- Events are immutable
- Include correlation ID for tracing
- Handle errors in event handlers gracefully

### 4. Command Execution
- Commands are imperative (CreateOrder, ProcessPayment)
- Commands are transactional units
- Validate before execution
- Return explicit results

### 5. Plugin System
- Plugins are isolated in child containers
- Declare dependencies explicitly
- Use hooks for extensibility
- Handle plugin errors independently

### 6. Configuration Management
- Validate on load
- Provide sensible defaults
- Never log secrets
- Support hierarchical access

### 7. Error Handling
- Use typed exceptions from exceptions module
- Include context information
- Chain original errors
- Log appropriately

## Development Guidelines

### Creating New Modules

1. Create `src/interfaces/{module}.ts` file
2. Export interfaces and types
3. Create `src/interfaces/README-{module}.md`
4. Update `src/interfaces/index.ts`
5. Update main `src/index.ts`
6. Document in this README

### Naming Conventions

- **Interfaces**: Use `I` prefix or descriptive name (Handler, Provider, etc)
- **Types**: Use exact domain terminology
- **Functions**: Use verb-first naming (create, handle, execute)
- **Constants**: Use UPPER_SNAKE_CASE

### Documentation Requirements

- JSDoc comments for all public types
- Usage examples in README
- Architecture diagrams
- Clear relationships
- Best practices

## Compilation & Type Checking

```bash
# Type check (no emit)
pnpm type-check

# Build TypeScript
pnpm build

# Lint with ESLint
pnpm lint

# Format with Prettier
pnpm format
```

## Package Information

- **Name**: @seltriva/core
- **Version**: 0.1.0
- **Type**: ES Module
- **Main**: ./dist/index.ts
- **Types**: ./dist/index.d.ts

## Dependencies

- **@seltriva/types** - Shared type definitions
- **@seltriva/logger** - Logging utilities

## Related Documentation

- [Main Architecture Guide](../../docs/ARCHITECTURE.md)
- [Development Guide](../../docs/DEVELOPMENT.md)
- [Architectural Decisions](../../docs/DECISIONS.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

## Future Roadmap

### Phase 2: Implementation
- Concrete DI container implementation
- Event bus implementation (memory, Redis)
- Command bus with middleware chain
- Configuration manager with providers
- Plugin loader and system

### Phase 3: Tools & Utilities
- Mapping/transformation library
- Sync engine with strategies
- Discovery/reflection utilities
- Registry implementations

### Phase 4: Extensions
- Distributed tracing support
- Metrics collection
- Distributed command/event handling
- Advanced plugin ecosystems
