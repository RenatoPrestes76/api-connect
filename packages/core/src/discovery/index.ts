/**
 * @seltriva/core/discovery
 * Service and type discovery interfaces — runtime metadata resolution
 */

// ─── Service Discovery ─────────────────────────────────────────────────────

/**
 * Registers and resolves running service instances (service mesh / health)
 */
export interface ServiceDiscovery {
  register(service: ServiceInstance): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  discoverAll(): Promise<ServiceInstance[]>;
  watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): void;
  getMetadata(serviceName: string): Promise<Record<string, unknown>>;
  healthCheck(serviceId: string): Promise<boolean>;
}

/**
 * A single registered service instance
 */
export interface ServiceInstance {
  readonly id: string;
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly url?: string;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: string[];
  readonly status: 'up' | 'down' | 'maintenance';
}

// ─── Type Discovery (Reflection) ───────────────────────────────────────────

/**
 * Discovers and reads TypeScript class/interface metadata at runtime
 */
export interface TypeDiscovery {
  discoverClasses(pattern: string): Promise<unknown[]>;
  discoverInterfaces(pattern: string): Promise<unknown[]>;
  getClassMetadata(target: unknown): ClassMetadata | null;
  getMethodMetadata(target: unknown, methodName: string): MethodMetadata | null;
  registerClassMetadata(target: unknown, metadata: ClassMetadata): void;
}

export interface ClassMetadata {
  readonly name: string;
  readonly constructor: unknown;
  readonly properties: PropertyMetadata[];
  readonly methods: MethodMetadata[];
  readonly decorators?: string[];
  readonly extends?: string;
  readonly implements?: string[];
}

export interface PropertyMetadata {
  readonly name: string;
  readonly type: unknown;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly decorators?: string[];
}

export interface MethodMetadata {
  readonly name: string;
  readonly parameters: ParameterMetadata[];
  readonly returnType: unknown;
  readonly decorators?: string[];
  readonly accessibility: 'public' | 'private' | 'protected';
  readonly static: boolean;
  readonly async: boolean;
}

export interface ParameterMetadata {
  readonly name: string;
  readonly type: unknown;
  readonly optional: boolean;
  readonly decorators?: string[];
}

// ─── Module Discovery ──────────────────────────────────────────────────────

/**
 * Discovers workspace modules and their dependency graph
 */
export interface ModuleDiscovery {
  discoverModules(rootPath: string): Promise<Module[]>;
  getModule(name: string): Module | null;
  getModuleDependencies(moduleName: string): string[];
  validateModuleStructure(module: Module): Promise<DiscoveryValidationResult>;
  getModuleExports(moduleName: string): Promise<Record<string, unknown>>;
}

export interface Module {
  readonly name: string;
  readonly path: string;
  readonly exports: string[];
  readonly dependencies: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface DiscoveryValidationResult {
  readonly isValid: boolean;
  readonly errors?: string[];
}

// ─── Driver Discovery ──────────────────────────────────────────────────────

/**
 * Scans and auto-registers available driver implementations
 */
export interface DriverDiscovery {
  scanForDrivers(rootPath: string): Promise<DriverDescriptor[]>;
  getDriverDescriptor(driverId: string): DriverDescriptor | null;
  validateDriver(descriptor: DriverDescriptor): Promise<DiscoveryValidationResult>;
}

export interface DriverDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly entryPoint: string;
  readonly capabilities: string[];
  readonly metadata?: Record<string, unknown>;
}
