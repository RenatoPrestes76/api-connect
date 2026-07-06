/**
 * Concrete ValueObject base class.
 * Identity is determined by structural equality of properties.
 */
export abstract class ValueObject<TProps extends Record<string, unknown>> {
  protected readonly props: TProps;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: ValueObject<TProps>): boolean {
    if (other === null || other === undefined) return false;
    if (this.constructor !== other.constructor) return false;
    return this.deepEqual(this.props, other.props);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
      this.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }

  toString(): string {
    return JSON.stringify(this.props);
  }

  toPlainObject(): TProps {
    return { ...this.props };
  }
}
