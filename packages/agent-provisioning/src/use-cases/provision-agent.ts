/**
 * ProvisionAgent — registers a new AtlasAgent using a provisioning token.
 *
 * This is the primary entry point for runtime agent self-registration.
 * The provisioning token acts as a bearer credential that scopes the
 * registration to a specific company.
 */
import type { RegisterAgentParams } from '@seltriva/agent-identity';
import {
  ProvisioningService,
  ProvisioningResult,
} from '../service/provisioning-service.js';

export interface ProvisionAgentInput {
  readonly rawToken:     string;
  readonly agentParams:  RegisterAgentParams;
}

export type ProvisionAgentOutput = ProvisioningResult;

export class ProvisionAgent {
  constructor(private readonly _service: ProvisioningService) {}

  async execute(input: ProvisionAgentInput): Promise<ProvisionAgentOutput> {
    return this._service.registerAgent(input.rawToken, input.agentParams);
  }
}
