export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (cause && !this.cause) {
      Object.defineProperty(this, 'cause', { value: cause });
    }
  }
}

export class ConnectionFailedError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class AuthenticationError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class TimeoutError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class QueryError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class SchemaError extends DatabaseError {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class DriverNotSupportedError extends DatabaseError {
  constructor(public readonly driverName: string, cause?: Error) {
    super(`Database driver "${driverName}" is not supported`, cause);
  }
}
