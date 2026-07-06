import { describe, it, expect } from 'vitest';
import {
  DatabaseError,
  ConnectionFailedError,
  AuthenticationError,
  TimeoutError,
  QueryError,
  TransactionError,
  SchemaError,
  DriverNotSupportedError,
} from '../errors/database-errors.js';

describe('DatabaseError hierarchy', () => {
  it('DatabaseError has correct name and message', () => {
    const err = new DatabaseError('base error');
    expect(err.message).toBe('base error');
    expect(err.name).toBe('DatabaseError');
    expect(err).toBeInstanceOf(Error);
  });

  it('DatabaseError stores cause', () => {
    const cause = new Error('root cause');
    const err   = new DatabaseError('wrapper', cause);
    expect(err.cause).toBe(cause);
  });

  it('ConnectionFailedError has correct name and inherits', () => {
    const err = new ConnectionFailedError('conn failed');
    expect(err.name).toBe('ConnectionFailedError');
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it('AuthenticationError has correct name and inherits', () => {
    const err = new AuthenticationError('auth failed');
    expect(err.name).toBe('AuthenticationError');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('TimeoutError has correct name and inherits', () => {
    const err = new TimeoutError('timed out');
    expect(err.name).toBe('TimeoutError');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('QueryError has correct name and inherits', () => {
    const err = new QueryError('bad sql');
    expect(err.name).toBe('QueryError');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('TransactionError has correct name and inherits', () => {
    const err = new TransactionError('tx failed');
    expect(err.name).toBe('TransactionError');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('SchemaError has correct name and inherits', () => {
    const err = new SchemaError('schema read failed');
    expect(err.name).toBe('SchemaError');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('DriverNotSupportedError has correct name and message', () => {
    const err = new DriverNotSupportedError('db2');
    expect(err.name).toBe('DriverNotSupportedError');
    expect(err.message).toContain('db2');
    expect(err.driverName).toBe('db2');
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('DriverNotSupportedError stores cause', () => {
    const cause = new Error('root');
    const err = new DriverNotSupportedError('sybase', cause);
    expect(err.cause).toBe(cause);
  });

  it('all typed errors store cause', () => {
    const cause = new Error('root');
    const errors = [
      new ConnectionFailedError('c', cause),
      new AuthenticationError('a', cause),
      new TimeoutError('t', cause),
      new QueryError('q', cause),
      new TransactionError('tr', cause),
      new SchemaError('s', cause),
    ];
    for (const e of errors) {
      expect(e.cause).toBe(cause);
    }
  });
});
