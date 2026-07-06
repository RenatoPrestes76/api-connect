/**
 * MachineId — hardware fingerprint that uniquely identifies the host machine.
 * Prevents duplicate agent registrations from the same physical host.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 256;
const ALLOWED_RE = /^[a-zA-Z0-9_\-:.]+$/;

export class MachineId {
  private constructor(private readonly _value: string) {}

  static fromString(value: string): MachineId {
    const v = value?.trim() ?? '';
    if (v.length < MIN_LENGTH) {
      throw new InvalidMachineIdError(value, `Must be at least ${MIN_LENGTH} characters`);
    }
    if (v.length > MAX_LENGTH) {
      throw new InvalidMachineIdError(value, `Must be at most ${MAX_LENGTH} characters`);
    }
    if (!ALLOWED_RE.test(v)) {
      throw new InvalidMachineIdError(value, 'Only alphanumeric, dash, underscore, colon and dot allowed');
    }
    return new MachineId(v);
  }

  toString(): string { return this._value; }

  equals(other: MachineId): boolean {
    return this._value === other._value;
  }
}

export class InvalidMachineIdError extends Error {
  readonly code = 'INVALID_MACHINE_ID';
  constructor(value: string, reason: string) {
    super(`Invalid MachineId "${value}": ${reason}`);
    this.name = 'InvalidMachineIdError';
  }
}
