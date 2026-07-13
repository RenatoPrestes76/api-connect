import { describe, it, expect } from 'vitest';
import { AgentId, InvalidAgentIdError } from '../value-objects/agent-id.js';
import { MachineId, InvalidMachineIdError } from '../value-objects/machine-id.js';
import { Hostname, InvalidHostnameError } from '../value-objects/hostname.js';
import { AgentVersion, InvalidAgentVersionError } from '../value-objects/agent-version.js';
import {
  AgentStatus,
  AgentStatusKind,
  InvalidStatusTransitionError,
} from '../value-objects/agent-status.js';

// ─── AgentId ─────────────────────────────────────────────────────────────────

describe('AgentId', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('generate() produces a valid UUID', () => {
    const id = AgentId.generate();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('fromString() accepts a valid UUID', () => {
    const id = AgentId.fromString(VALID_UUID);
    expect(id.toString()).toBe(VALID_UUID);
  });

  it('fromString() normalises to lowercase', () => {
    const id = AgentId.fromString(VALID_UUID.toUpperCase());
    expect(id.toString()).toBe(VALID_UUID.toLowerCase());
  });

  it('fromString() trims surrounding whitespace', () => {
    const id = AgentId.fromString(`  ${VALID_UUID}  `);
    expect(id.toString()).toBe(VALID_UUID);
  });

  it('fromString() throws InvalidAgentIdError for a bad value', () => {
    expect(() => AgentId.fromString('not-a-uuid')).toThrowError(InvalidAgentIdError);
  });

  it('fromString() throws for empty string', () => {
    expect(() => AgentId.fromString('')).toThrowError(InvalidAgentIdError);
  });

  it('equals() returns true for equal ids', () => {
    const a = AgentId.fromString(VALID_UUID);
    const b = AgentId.fromString(VALID_UUID);
    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different ids', () => {
    const a = AgentId.generate();
    const b = AgentId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it('InvalidAgentIdError has the correct code', () => {
    try {
      AgentId.fromString('bad');
    } catch (e) {
      expect((e as InvalidAgentIdError).code).toBe('INVALID_AGENT_ID');
    }
  });
});

// ─── MachineId ───────────────────────────────────────────────────────────────

describe('MachineId', () => {
  const VALID = 'BIOS-1234-ABCD';

  it('accepts a valid machine id', () => {
    const m = MachineId.fromString(VALID);
    expect(m.toString()).toBe(VALID);
  });

  it('throws when too short (< 8 chars)', () => {
    expect(() => MachineId.fromString('abc')).toThrowError(InvalidMachineIdError);
  });

  it('throws when too long (> 256 chars)', () => {
    expect(() => MachineId.fromString('a'.repeat(257))).toThrowError(InvalidMachineIdError);
  });

  it('throws for invalid characters (space)', () => {
    expect(() => MachineId.fromString('has spaces here')).toThrowError(InvalidMachineIdError);
  });

  it('equals() true for same value', () => {
    expect(MachineId.fromString(VALID).equals(MachineId.fromString(VALID))).toBe(true);
  });

  it('equals() false for different values', () => {
    expect(MachineId.fromString(VALID).equals(MachineId.fromString('OTHER-5678-EFGH'))).toBe(false);
  });

  it('InvalidMachineIdError has the correct code', () => {
    try {
      MachineId.fromString('x');
    } catch (e) {
      expect((e as InvalidMachineIdError).code).toBe('INVALID_MACHINE_ID');
    }
  });

  it('accepts exactly 8 characters', () => {
    const m = MachineId.fromString('12345678');
    expect(m.toString()).toBe('12345678');
  });

  it('accepts colons and dots', () => {
    const m = MachineId.fromString('aa:bb:cc:dd:ee:ff');
    expect(m.toString()).toBe('aa:bb:cc:dd:ee:ff');
  });
});

// ─── Hostname ─────────────────────────────────────────────────────────────────

describe('Hostname', () => {
  it('accepts a valid FQDN and normalises to lowercase', () => {
    const h = Hostname.fromString('Agent-Server.ACME.com');
    expect(h.toString()).toBe('agent-server.acme.com');
  });

  it('accepts a short hostname', () => {
    expect(Hostname.fromString('localhost').toString()).toBe('localhost');
  });

  it('throws for empty string', () => {
    expect(() => Hostname.fromString('')).toThrowError(InvalidHostnameError);
  });

  it('throws for hostname with spaces', () => {
    expect(() => Hostname.fromString('bad hostname')).toThrowError(InvalidHostnameError);
  });

  it('throws for hostname exceeding 253 characters', () => {
    expect(() => Hostname.fromString('a'.repeat(254))).toThrowError(InvalidHostnameError);
  });

  it('throws for hostname starting with a hyphen', () => {
    expect(() => Hostname.fromString('-invalid')).toThrowError(InvalidHostnameError);
  });

  it('equals() true for normalised equivalents', () => {
    const a = Hostname.fromString('SERVER1');
    const b = Hostname.fromString('server1');
    expect(a.equals(b)).toBe(true);
  });

  it('equals() false for different hostnames', () => {
    expect(Hostname.fromString('server1').equals(Hostname.fromString('server2'))).toBe(false);
  });

  it('InvalidHostnameError has the correct code', () => {
    try {
      Hostname.fromString('');
    } catch (e) {
      expect((e as InvalidHostnameError).code).toBe('INVALID_HOSTNAME');
    }
  });
});

// ─── AgentVersion ─────────────────────────────────────────────────────────────

describe('AgentVersion', () => {
  it('parses a valid semver string', () => {
    const v = AgentVersion.fromString('2.3.4');
    expect(v.major).toBe(2);
    expect(v.minor).toBe(3);
    expect(v.patch).toBe(4);
    expect(v.toString()).toBe('2.3.4');
  });

  it('parses 0.0.0 (zero version)', () => {
    const v = AgentVersion.fromString('0.0.0');
    expect(v.toString()).toBe('0.0.0');
  });

  it('throws for non-semver string', () => {
    expect(() => AgentVersion.fromString('1.2')).toThrowError(InvalidAgentVersionError);
    expect(() => AgentVersion.fromString('1.2.3.4')).toThrowError(InvalidAgentVersionError);
    expect(() => AgentVersion.fromString('v1.2.3')).toThrowError(InvalidAgentVersionError);
    expect(() => AgentVersion.fromString('')).toThrowError(InvalidAgentVersionError);
  });

  describe('isNewerThan()', () => {
    it('higher major → newer', () => {
      expect(AgentVersion.fromString('2.0.0').isNewerThan(AgentVersion.fromString('1.9.9'))).toBe(
        true
      );
    });

    it('same major, higher minor → newer', () => {
      expect(AgentVersion.fromString('1.2.0').isNewerThan(AgentVersion.fromString('1.1.9'))).toBe(
        true
      );
    });

    it('same major+minor, higher patch → newer', () => {
      expect(AgentVersion.fromString('1.1.2').isNewerThan(AgentVersion.fromString('1.1.1'))).toBe(
        true
      );
    });

    it('identical version → not newer', () => {
      expect(AgentVersion.fromString('1.2.3').isNewerThan(AgentVersion.fromString('1.2.3'))).toBe(
        false
      );
    });

    it('lower version → not newer', () => {
      expect(AgentVersion.fromString('1.0.0').isNewerThan(AgentVersion.fromString('2.0.0'))).toBe(
        false
      );
    });
  });

  describe('equals()', () => {
    it('same version → equal', () => {
      expect(AgentVersion.fromString('3.2.1').equals(AgentVersion.fromString('3.2.1'))).toBe(true);
    });

    it('different version → not equal', () => {
      expect(AgentVersion.fromString('1.0.0').equals(AgentVersion.fromString('1.0.1'))).toBe(false);
    });
  });

  it('InvalidAgentVersionError has the correct code', () => {
    try {
      AgentVersion.fromString('bad');
    } catch (e) {
      expect((e as InvalidAgentVersionError).code).toBe('INVALID_AGENT_VERSION');
    }
  });
});

// ─── AgentStatus ─────────────────────────────────────────────────────────────

describe('AgentStatus', () => {
  it('initial() starts in REGISTERING', () => {
    const s = AgentStatus.initial();
    expect(s.value).toBe(AgentStatusKind.REGISTERING);
  });

  it('fromKind() creates correct status', () => {
    const s = AgentStatus.fromKind(AgentStatusKind.ONLINE);
    expect(s.value).toBe(AgentStatusKind.ONLINE);
    expect(s.isOnline()).toBe(true);
  });

  it('canTransitionTo() returns true for valid transition', () => {
    const s = AgentStatus.initial();
    expect(s.canTransitionTo(AgentStatusKind.ONLINE)).toBe(true);
  });

  it('canTransitionTo() returns false for invalid transition', () => {
    const s = AgentStatus.initial();
    expect(s.canTransitionTo(AgentStatusKind.OFFLINE)).toBe(false);
  });

  it('transitionTo() succeeds for valid transition', () => {
    const online = AgentStatus.initial().transitionTo(AgentStatusKind.ONLINE);
    expect(online.isOnline()).toBe(true);
  });

  it('transitionTo() throws InvalidStatusTransitionError for illegal jump', () => {
    const s = AgentStatus.initial();
    expect(() => s.transitionTo(AgentStatusKind.DISABLED)).toThrowError(
      InvalidStatusTransitionError
    );
  });

  it('DISABLED allows only re-enable to REGISTERING', () => {
    const disabled = AgentStatus.fromKind(AgentStatusKind.DISABLED);
    expect(disabled.canTransitionTo(AgentStatusKind.REGISTERING)).toBe(true);
    for (const kind of Object.values(AgentStatusKind).filter(
      (k) => k !== AgentStatusKind.REGISTERING
    )) {
      expect(disabled.canTransitionTo(kind)).toBe(false);
    }
  });

  it('full happy path: REGISTERING → ONLINE → SYNCING → ONLINE → OFFLINE → ONLINE → DISABLED', () => {
    let s = AgentStatus.initial();
    s = s.transitionTo(AgentStatusKind.ONLINE);
    s = s.transitionTo(AgentStatusKind.SYNCING);
    s = s.transitionTo(AgentStatusKind.ONLINE);
    s = s.transitionTo(AgentStatusKind.OFFLINE);
    s = s.transitionTo(AgentStatusKind.ONLINE);
    s = s.transitionTo(AgentStatusKind.DISABLED);
    expect(s.isDisabled()).toBe(true);
  });

  it('ONLINE → ERROR → OFFLINE path works', () => {
    const s = AgentStatus.fromKind(AgentStatusKind.ONLINE)
      .transitionTo(AgentStatusKind.ERROR)
      .transitionTo(AgentStatusKind.OFFLINE);
    expect(s.isOffline()).toBe(true);
  });

  it('SYNCING → ERROR path works', () => {
    const s = AgentStatus.fromKind(AgentStatusKind.SYNCING).transitionTo(AgentStatusKind.ERROR);
    expect(s.isError()).toBe(true);
  });

  it('equals() is structural', () => {
    const a = AgentStatus.fromKind(AgentStatusKind.ONLINE);
    const b = AgentStatus.fromKind(AgentStatusKind.ONLINE);
    const c = AgentStatus.fromKind(AgentStatusKind.OFFLINE);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toString() returns the kind string', () => {
    expect(AgentStatus.fromKind(AgentStatusKind.SYNCING).toString()).toBe('SYNCING');
  });

  it('isSyncing() predicate works', () => {
    expect(AgentStatus.fromKind(AgentStatusKind.SYNCING).isSyncing()).toBe(true);
    expect(AgentStatus.fromKind(AgentStatusKind.ONLINE).isSyncing()).toBe(false);
  });

  it('InvalidStatusTransitionError has the correct code', () => {
    try {
      AgentStatus.initial().transitionTo(AgentStatusKind.DISABLED);
    } catch (e) {
      expect((e as InvalidStatusTransitionError).code).toBe('INVALID_STATUS_TRANSITION');
    }
  });
});
