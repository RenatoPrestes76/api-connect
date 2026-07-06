import type { ConnectorMetadata } from '@seltriva/connector-sdk';

export const ERP_METADATA: ConnectorMetadata = {
  id:          'com.seltriva.connector-erp',
  name:        'connector-erp',
  displayName: 'Generic ERP Provider',
  version:     '0.1.0',
  sdkVersion:  '0.1.0',
  vendor:      'Seltriva',
  category:    'erp',
  description: 'Generic ERP connector that simulates bi-directional data synchronization with any ERP system.',
  compatibility: { min: '0.1.0' },
  dependencies:  [],
  permissions: [
    'network:outbound',
    'credentials:read',
    'config:read',
    'events:emit',
    'scheduler:register',
  ],
  capabilities: {
    canDiscover:    true,
    canSynchronize: true,
    canValidate:    true,
    canStream:      false,
    canBulkWrite:   false,
    supportsSSL:    true,
  },
  updatable: true,
  homepage:  'https://seltriva.com/connectors/erp',
};
