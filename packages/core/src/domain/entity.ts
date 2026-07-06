/**
 * Concrete Entity base class.
 * Identity is determined by id, not attributes.
 */
import type { DomainEvent } from '../interfaces/index.js';

export abstract class Entity<TId = string> {
  protected readonly _id: TId;

  constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(other: Entity<TId>): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    if (this.constructor !== other.constructor) return false;
    return this._id === other._id;
  }

  toString(): string {
    return `${this.constructor.name}(${String(this._id)})`;
  }
}

/**
 * Concrete AggregateRoot base class.
 * Adds domain event tracking and optimistic concurrency version.
 */
export abstract class AggregateRoot<TId = string> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];
  private _version: number;

  constructor(id: TId, version = 0) {
    super(id);
    this._version = version;
  }

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  getVersion(): number {
    return this._version;
  }

  protected incrementVersion(): void {
    this._version += 1;
  }
}
