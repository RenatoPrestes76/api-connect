/**
 * @seltriva/core/commands
 * Command Bus interfaces — CQRS Pattern
 */

/**
 * Base command contract
 */
export interface Command {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly causationId?: string;
}

/**
 * Result returned after command execution
 */
export interface CommandResult<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: string;
  readonly errors?: Record<string, string[]>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Handles a specific command type
 */
export interface CommandHandler<TCommand extends Command = Command, TResult = unknown> {
  handle(command: TCommand): Promise<CommandResult<TResult>>;
  getCommandType(): string;
}

/**
 * Dispatches commands to the bus
 */
export interface CommandPublisher {
  dispatch<TResult = unknown>(command: Command): Promise<CommandResult<TResult>>;
  dispatchBatch(commands: Command[]): Promise<CommandResult[]>;
}

/**
 * Registry that maps command types to handlers
 */
export interface CommandHandlerRegistry {
  register<TCommand extends Command, TResult>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void;
  unregister(commandType: string): void;
  getHandler<TCommand extends Command, TResult>(
    commandType: string
  ): CommandHandler<TCommand, TResult> | null;
  hasHandler(commandType: string): boolean;
  getRegisteredTypes(): string[];
}

/**
 * Central command bus — dispatches commands to their registered handlers
 */
export interface CommandBus extends CommandPublisher, CommandHandlerRegistry {
  clear(): void;
}

/**
 * Validates a command before it is dispatched
 */
export interface CommandValidator<TCommand extends Command = Command> {
  validate(command: TCommand): Promise<CommandValidationResult>;
  getCommandType(): string;
}

/**
 * Result of command validation
 */
export interface CommandValidationResult {
  readonly isValid: boolean;
  readonly errors?: Record<string, string[]>;
}

/**
 * Individual validation rule
 */
export interface ValidationRule<TCommand extends Command = Command> {
  validate(command: TCommand): Promise<boolean>;
  getMessage(): string;
  getFieldName?(): string;
}

/**
 * Middleware that wraps command execution (logging, auth, retry, etc.)
 */
export interface CommandMiddleware<TCommand extends Command = Command, TResult = unknown> {
  execute(
    command: TCommand,
    next: (cmd: TCommand) => Promise<CommandResult<TResult>>
  ): Promise<CommandResult<TResult>>;
  readonly order: number;
  readonly name: string;
}

/**
 * Query contract (read side of CQRS)
 */
export interface Query {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Handles a specific query type
 */
export interface QueryHandler<TQuery extends Query = Query, TResult = unknown> {
  handle(query: TQuery): Promise<TResult>;
  getQueryType(): string;
}

/**
 * Dispatches queries to their handlers
 */
export interface QueryBus {
  ask<TResult = unknown>(query: Query): Promise<TResult>;
  register<TQuery extends Query, TResult>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void;
  unregister(queryType: string): void;
  hasHandler(queryType: string): boolean;
}
