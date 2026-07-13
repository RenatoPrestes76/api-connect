import { postJson, HttpError } from '../utils/http-client.js';
import { isValidTokenFormat, normalizeToken, TokenFormatError } from './token-validator.js';

export interface RegistrationInput {
  activationToken: string;
  name: string;
  hostname: string;
  machineId: string;
  version: string;
  connectorType: string;
  apiBaseUrl: string;
}

export interface RuntimeCredentials {
  runtimeId: string;
  companyId: string;
  environment: string;
  runtimeToken: string;
  heartbeatUrl: string;
  syncUrl: string;
}

export class RegistrationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

export async function registerRuntime(input: RegistrationInput): Promise<RuntimeCredentials> {
  const token = normalizeToken(input.activationToken);

  if (!isValidTokenFormat(token)) {
    throw new TokenFormatError(token);
  }

  const url = `${input.apiBaseUrl.replace(/\/$/, '')}/api/v1/activate`;

  try {
    return await postJson<Omit<RegistrationInput, 'apiBaseUrl'>, RuntimeCredentials>(url, {
      activationToken: token,
      name: input.name,
      hostname: input.hostname,
      machineId: input.machineId,
      version: input.version,
      connectorType: input.connectorType,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new RegistrationError(httpErrorMessage(err.code, err.message), err.code);
    }
    throw err;
  }
}

function httpErrorMessage(code: string, message: string): string {
  switch (code) {
    case 'TOKEN_NOT_FOUND':
      return 'Activation token not found. Please check the token and try again.';
    case 'TOKEN_EXPIRED':
      return 'Activation token has expired. Request a new token from the console.';
    case 'TOKEN_USED':
      return 'Activation token has already been used. Each token can only be used once.';
    case 'MACHINE_ALREADY_REGISTERED':
      return 'This machine is already registered. Use the console to manage the existing agent.';
    case 'VALIDATION_ERROR':
      return `Validation error: ${message}`;
    default:
      return message;
  }
}
