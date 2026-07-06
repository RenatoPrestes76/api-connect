/** OpenAPI 3.1 specification for the Atlas Control Plane Agent API. */
export const atlasOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Atlas Control Plane — Agent API',
    version: '1.0.0',
    description: 'REST API used by Runtime Agents to self-register, send heartbeats, report synchronisation status, and query their own identity.',
  },
  servers: [{ url: '/api/v1', description: 'Current environment' }],
  components: {
    securitySchemes: {
      agentBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'aat_<sha256-hex>',
        description: 'Agent Access Token issued at provisioning time. Format: aat_<64 hex chars>.',
      },
    },
    schemas: {
      ProvisionRequest: {
        type: 'object',
        required: ['rawToken', 'machineId', 'hostname', 'connectorType', 'version', 'name', 'companyId'],
        properties: {
          rawToken:      { type: 'string', pattern: '^slp_[0-9a-f]{64}$', example: 'slp_abc123...' },
          machineId:     { type: 'string', minLength: 8, maxLength: 256, example: 'MACHINE-PS001-PROD' },
          hostname:      { type: 'string', maxLength: 253, example: 'runtime01.acme.internal' },
          connectorType: { type: 'string', example: 'MSSQL' },
          version:       { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$', example: '1.0.0' },
          name:          { type: 'string', example: 'Pais e Filhos Runtime' },
          companyId:     { type: 'string', example: 'co_pais-e-filhos' },
        },
      },
      ProvisionResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              agentId:     { type: 'string', description: 'Assigned agent identifier.' },
              accessToken: { type: 'string', description: 'Agent Access Token — store securely, never logged.' },
            },
          },
        },
      },
      HeartbeatRequest: {
        type: 'object',
        properties: {
          hostname: { type: 'string', description: 'Current hostname (optional — updates if changed).' },
          version:  { type: 'string', description: 'Current binary version (optional — updates if newer).' },
        },
      },
      HeartbeatResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              agentId:       { type: 'string' },
              status:        { type: 'string', enum: ['ONLINE'] },
              lastHeartbeat: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      SyncStatusRequest: {
        type: 'object',
        properties: {
          syncedAt: { type: 'string', format: 'date-time', description: 'ISO-8601 timestamp when sync completed (defaults to server time).' },
        },
      },
      SyncStatusResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              agentId:             { type: 'string' },
              lastSynchronization: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      AgentIdentity: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              agentId:             { type: 'string' },
              companyId:           { type: 'string' },
              name:                { type: 'string' },
              hostname:            { type: 'string' },
              machineId:           { type: 'string' },
              connectorType:       { type: 'string' },
              version:             { type: 'string' },
              status:              { type: 'string', enum: ['REGISTERING', 'ONLINE', 'OFFLINE', 'SYNCING', 'ERROR', 'DISABLED'] },
              lastHeartbeat:       { type: ['string', 'null'], format: 'date-time' },
              lastSynchronization: { type: ['string', 'null'], format: 'date-time' },
              createdAt:           { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code:    { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/provision': {
      post: {
        summary: 'Provision a new Runtime Agent',
        description: 'Validates a provisioning token, registers the agent, and returns a long-lived Agent Access Token.',
        tags: ['Atlas Agent'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProvisionRequest' } } },
        },
        responses: {
          '201': { description: 'Agent registered successfully.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProvisionResponse' } } } },
          '401': { description: 'Token invalid, expired, or revoked.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Company mismatch between token and request.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Machine ID already registered.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '422': { description: 'Validation error in agent parameters.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/heartbeat': {
      post: {
        summary: 'Send a heartbeat ping',
        description: 'Updates lastHeartbeat, optionally updates hostname and version, and transitions agent status to ONLINE.',
        tags: ['Atlas Agent'],
        security: [{ agentBearer: [] }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HeartbeatRequest' } } },
        },
        responses: {
          '200': { description: 'Heartbeat recorded.', content: { 'application/json': { schema: { $ref: '#/components/schemas/HeartbeatResponse' } } } },
          '401': { description: 'Missing or invalid agent token.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Agent not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/sync-status': {
      post: {
        summary: 'Report synchronisation completion',
        description: 'Records the time of the last successful data synchronisation.',
        tags: ['Atlas Agent'],
        security: [{ agentBearer: [] }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncStatusRequest' } } },
        },
        responses: {
          '200': { description: 'Sync status recorded.', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncStatusResponse' } } } },
          '401': { description: 'Missing or invalid agent token.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Agent not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/me': {
      get: {
        summary: 'Get agent identity',
        description: 'Returns the full identity and status of the authenticated agent.',
        tags: ['Atlas Agent'],
        security: [{ agentBearer: [] }],
        responses: {
          '200': { description: 'Agent identity.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentIdentity' } } } },
          '401': { description: 'Missing or invalid agent token.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Agent not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
} as const;
