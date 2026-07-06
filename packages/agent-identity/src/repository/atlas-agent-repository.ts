/**
 * AtlasAgentRepository — port (interface) for agent persistence.
 * Implementations live in the infrastructure layer; this interface belongs
 * to the domain.
 */
import type { AtlasAgent } from '../entity/atlas-agent.js';

export interface AtlasAgentRepository {
  /** Persist a newly created agent. Throws if the id already exists. */
  save(agent: AtlasAgent): Promise<void>;

  /** Overwrite an existing agent's state. Throws if not found. */
  update(agent: AtlasAgent): Promise<void>;

  /** Find by primary id. Returns null when not found. */
  findById(id: string): Promise<AtlasAgent | null>;

  /** Find by machine fingerprint. Returns null when not found. */
  findByMachineId(machineId: string): Promise<AtlasAgent | null>;

  /** All agents belonging to a company. */
  findByCompany(companyId: string): Promise<AtlasAgent[]>;

  /** All agents whose status is ONLINE. */
  findOnline(): Promise<AtlasAgent[]>;

  /** Return every agent (used by admin queries that filter/paginate in memory). */
  findAll(): Promise<AtlasAgent[]>;

  /** Hard-delete an agent record. No-op when not found. */
  delete(id: string): Promise<void>;
}
