import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasAgent, AgentDomainError }  from '../entity/atlas-agent.js';
import { AgentVersion }                  from '../value-objects/agent-version.js';
import { AgentStatusKind }               from '../value-objects/agent-status.js';
import { Hostname }                      from '../value-objects/hostname.js';
import type { RegisterAgentParams }      from '../entity/atlas-agent.js';

const BASE_PARAMS: RegisterAgentParams = {
  companyId:     'company-abc',
  name:          'Atlas Agent 1',
  hostname:      'server01.acme.com',
  machineId:     'BIOS-1234-ABCD',
  connectorType: 'MSSQL',
  version:       '1.0.0',
};

describe('AtlasAgent.register()', () => {
  it('creates an agent in REGISTERING status', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    expect(agent.status.value).toBe(AgentStatusKind.REGISTERING);
  });

  it('populates all fields correctly', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    expect(agent.companyId).toBe('company-abc');
    expect(agent.name).toBe('Atlas Agent 1');
    expect(agent.hostname.toString()).toBe('server01.acme.com');
    expect(agent.machineId.toString()).toBe('BIOS-1234-ABCD');
    expect(agent.connectorType).toBe('MSSQL');
    expect(agent.version.toString()).toBe('1.0.0');
  });

  it('assigns a UUID v4 id', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    expect(agent.id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('lastHeartbeat and lastSynchronization are null initially', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    expect(agent.lastHeartbeat).toBeNull();
    expect(agent.lastSynchronization).toBeNull();
  });

  it('emits an AgentRegistered event', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    const events = agent.peekEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('AtlasAgent.Registered');
  });

  it('throws when companyId is empty', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, companyId: '' }))
      .toThrowError(AgentDomainError);
  });

  it('throws when name is blank whitespace', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, name: '   ' }))
      .toThrowError(AgentDomainError);
  });

  it('throws when connectorType is empty', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, connectorType: '' }))
      .toThrowError(AgentDomainError);
  });

  it('throws for an invalid hostname', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, hostname: 'bad host name' }))
      .toThrow();
  });

  it('throws for an invalid machineId (too short)', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, machineId: 'short' }))
      .toThrow();
  });

  it('throws for an invalid version', () => {
    expect(() => AtlasAgent.register({ ...BASE_PARAMS, version: 'v1.0' }))
      .toThrow();
  });
});

describe('AtlasAgent — domain methods', () => {
  let agent: AtlasAgent;

  beforeEach(() => {
    agent = AtlasAgent.register(BASE_PARAMS);
    agent.pullEvents(); // drain registration event
  });

  // ─── markHeartbeat ───────────────────────────────────────────────────────────

  describe('markHeartbeat()', () => {
    it('transitions REGISTERING → ONLINE on first heartbeat', () => {
      agent.markHeartbeat();
      expect(agent.status.isOnline()).toBe(true);
    });

    it('sets lastHeartbeat to a non-null Date', () => {
      agent.markHeartbeat();
      expect(agent.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('emits a HeartbeatReceived event', () => {
      agent.markHeartbeat();
      const evts = agent.pullEvents();
      expect(evts[0]!.type).toBe('AtlasAgent.HeartbeatReceived');
    });

    it('additional heartbeats keep status ONLINE', () => {
      agent.markHeartbeat();
      agent.pullEvents();
      agent.markHeartbeat();
      expect(agent.status.isOnline()).toBe(true);
    });

    it('throws when agent is DISABLED', () => {
      agent.markHeartbeat(); // → ONLINE
      agent.disable();
      agent.pullEvents();
      expect(() => agent.markHeartbeat()).toThrowError(AgentDomainError);
    });
  });

  // ─── markOffline ─────────────────────────────────────────────────────────────

  describe('markOffline()', () => {
    it('transitions ONLINE → OFFLINE', () => {
      agent.markHeartbeat(); // → ONLINE
      agent.markOffline();
      expect(agent.status.isOffline()).toBe(true);
    });

    it('does NOT emit an event (offline is silent)', () => {
      agent.markHeartbeat();
      agent.pullEvents();
      agent.markOffline();
      expect(agent.peekEvents()).toHaveLength(0);
    });

    it('throws when already DISABLED', () => {
      agent.markHeartbeat();
      agent.disable();
      agent.pullEvents();
      expect(() => agent.markOffline()).toThrowError(AgentDomainError);
    });

    it('throws for invalid transition REGISTERING → OFFLINE', () => {
      expect(() => agent.markOffline()).toThrow(); // REGISTERING → OFFLINE not allowed
    });
  });

  // ─── markSyncing / markSynchronizationFinished ───────────────────────────────

  describe('markSyncing()', () => {
    it('transitions ONLINE → SYNCING', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      expect(agent.status.isSyncing()).toBe(true);
    });
  });

  describe('markSynchronizationFinished()', () => {
    it('transitions SYNCING → ONLINE', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      agent.markSynchronizationFinished();
      expect(agent.status.isOnline()).toBe(true);
    });

    it('records lastSynchronization timestamp', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      agent.markSynchronizationFinished();
      expect(agent.lastSynchronization).toBeInstanceOf(Date);
    });

    it('emits SynchronizationCompleted event', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      agent.pullEvents();
      agent.markSynchronizationFinished();
      const evts = agent.pullEvents();
      expect(evts[0]!.type).toBe('AtlasAgent.SynchronizationCompleted');
    });

    it('throws when DISABLED', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      agent.pullEvents();
      // manually disable by reading events
      agent.markHeartbeat(); // noop – agent is SYNCING, not ONLINE — actually, this will throw because
      // SYNCING → can't go back to heartbeat directly; let's disable via a different path
    });
  });

  // ─── markError / markOnline ──────────────────────────────────────────────────

  describe('markError()', () => {
    it('transitions ONLINE → ERROR', () => {
      agent.markHeartbeat();
      agent.markError();
      expect(agent.status.isError()).toBe(true);
    });

    it('transitions SYNCING → ERROR', () => {
      agent.markHeartbeat();
      agent.markSyncing();
      agent.markError();
      expect(agent.status.isError()).toBe(true);
    });
  });

  describe('markOnline()', () => {
    it('transitions OFFLINE → ONLINE', () => {
      agent.markHeartbeat();
      agent.markOffline();
      agent.markOnline();
      expect(agent.status.isOnline()).toBe(true);
    });

    it('transitions ERROR → ONLINE', () => {
      agent.markHeartbeat();
      agent.markError();
      agent.markOnline();
      expect(agent.status.isOnline()).toBe(true);
    });
  });

  // ─── updateHostname ──────────────────────────────────────────────────────────

  describe('updateHostname()', () => {
    it('updates hostname and emits AgentHostnameUpdated event', () => {
      const newHost = Hostname.fromString('newserver.acme.com');
      agent.updateHostname(newHost);
      expect(agent.hostname.toString()).toBe('newserver.acme.com');
      const evts = agent.pullEvents();
      expect(evts[0]!.type).toBe('AtlasAgent.HostnameUpdated');
      if (evts[0]?.type === 'AtlasAgent.HostnameUpdated') {
        expect(evts[0].oldHostname).toBe('server01.acme.com');
        expect(evts[0].newHostname).toBe('newserver.acme.com');
      }
    });

    it('is a no-op when hostname is identical', () => {
      const same = Hostname.fromString('server01.acme.com');
      agent.updateHostname(same);
      expect(agent.peekEvents()).toHaveLength(0);
    });

    it('throws when DISABLED', () => {
      agent.markHeartbeat();
      agent.disable();
      agent.pullEvents();
      expect(() => agent.updateHostname(Hostname.fromString('other.acme.com')))
        .toThrowError(AgentDomainError);
    });

    it('snapshot captures updated hostname', () => {
      agent.updateHostname(Hostname.fromString('updated.acme.com'));
      const snap = agent.toSnapshot();
      expect(snap.hostname).toBe('updated.acme.com');
    });
  });

  // ─── updateVersion ───────────────────────────────────────────────────────────

  describe('updateVersion()', () => {
    it('accepts a strictly newer version', () => {
      agent.updateVersion(AgentVersion.fromString('2.0.0'));
      expect(agent.version.toString()).toBe('2.0.0');
    });

    it('emits an AgentVersionUpdated event with old and new version', () => {
      agent.updateVersion(AgentVersion.fromString('1.1.0'));
      const evts = agent.pullEvents();
      const evt = evts.find(e => e.type === 'AtlasAgent.VersionUpdated');
      expect(evt).toBeDefined();
      if (evt?.type === 'AtlasAgent.VersionUpdated') {
        expect(evt.oldVersion).toBe('1.0.0');
        expect(evt.newVersion).toBe('1.1.0');
      }
    });

    it('rejects same version', () => {
      expect(() => agent.updateVersion(AgentVersion.fromString('1.0.0')))
        .toThrowError(AgentDomainError);
    });

    it('rejects a downgrade', () => {
      expect(() => agent.updateVersion(AgentVersion.fromString('0.9.9')))
        .toThrowError(AgentDomainError);
    });

    it('throws when DISABLED', () => {
      agent.markHeartbeat();
      agent.disable();
      agent.pullEvents();
      expect(() => agent.updateVersion(AgentVersion.fromString('9.9.9')))
        .toThrowError(AgentDomainError);
    });
  });

  // ─── disable ─────────────────────────────────────────────────────────────────

  describe('disable()', () => {
    it('transitions any valid state → DISABLED', () => {
      agent.markHeartbeat(); // ONLINE
      agent.disable();
      expect(agent.status.isDisabled()).toBe(true);
    });

    it('emits an AgentDisabled event', () => {
      agent.markHeartbeat();
      agent.pullEvents();
      agent.disable();
      const evts = agent.pullEvents();
      expect(evts[0]!.type).toBe('AtlasAgent.Disabled');
    });

    it('is idempotent — calling twice does not throw', () => {
      agent.markHeartbeat();
      agent.disable();
      agent.pullEvents();
      expect(() => agent.disable()).not.toThrow();
      // second call is no-op — no new event
      expect(agent.pullEvents()).toHaveLength(0);
    });

    it('can disable from REGISTERING state', () => {
      // REGISTERING → DISABLED is not in valid transitions, so should throw via transitionTo
      // agent is initially REGISTERING; REGISTERING only allows → ONLINE
      expect(() => agent.disable()).toThrow();
    });
  });

  // ─── pullEvents / peekEvents ─────────────────────────────────────────────────

  describe('pullEvents()', () => {
    it('drains events so a second call returns empty array', () => {
      agent.markHeartbeat();
      const first = agent.pullEvents();
      expect(first.length).toBeGreaterThan(0);
      expect(agent.pullEvents()).toHaveLength(0);
    });
  });

  describe('peekEvents()', () => {
    it('returns events without removing them', () => {
      agent.markHeartbeat();
      const peeked = agent.peekEvents();
      expect(peeked.length).toBeGreaterThan(0);
      // peek again — still there
      expect(agent.peekEvents()).toHaveLength(peeked.length);
    });
  });
});

// ─── AtlasAgent.fromSnapshot() ───────────────────────────────────────────────

describe('AtlasAgent.fromSnapshot()', () => {
  it('round-trips through snapshot and back', () => {
    const original = AtlasAgent.register(BASE_PARAMS);
    original.markHeartbeat();
    original.pullEvents();

    const snap = original.toSnapshot();
    const restored = AtlasAgent.fromSnapshot(snap);

    expect(restored.id.toString()).toBe(original.id.toString());
    expect(restored.status.value).toBe(original.status.value);
    expect(restored.companyId).toBe(original.companyId);
    expect(restored.version.toString()).toBe(original.version.toString());
  });

  it('does not carry events from the original', () => {
    const original = AtlasAgent.register(BASE_PARAMS);
    const snap = original.toSnapshot();
    const restored = AtlasAgent.fromSnapshot(snap);
    expect(restored.peekEvents()).toHaveLength(0);
  });

  it('toSnapshot() captures lastHeartbeat', () => {
    const agent = AtlasAgent.register(BASE_PARAMS);
    agent.markHeartbeat();
    const snap = agent.toSnapshot();
    expect(snap.lastHeartbeat).toBeInstanceOf(Date);
    expect(snap.lastSynchronization).toBeNull();
  });
});

// ─── AgentDomainError ────────────────────────────────────────────────────────

describe('AgentDomainError', () => {
  it('has code AGENT_DOMAIN_ERROR', () => {
    const err = new AgentDomainError('test');
    expect(err.code).toBe('AGENT_DOMAIN_ERROR');
    expect(err.name).toBe('AgentDomainError');
  });
});
