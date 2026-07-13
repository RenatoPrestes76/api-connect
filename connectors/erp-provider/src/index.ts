import type { ConnectorFactory, ConnectorContext } from '@seltriva/connector-sdk';
import { ErpConnector } from './provider.js';

export { ErpConnector } from './provider.js';
export { ERP_METADATA } from './metadata.js';
export { ERP_CONFIG_SCHEMA } from './config/schema.js';
export { mapProduct, mapCustomer, mapInventory } from './mapper.js';
export type {
  ErpProduct,
  ErpCustomer,
  ErpInventoryItem,
  AtlasProduct,
  AtlasCustomer,
  AtlasInventory,
} from './mapper.js';

const factory: ConnectorFactory = (context: ConnectorContext) => new ErpConnector(context);
export default factory;
