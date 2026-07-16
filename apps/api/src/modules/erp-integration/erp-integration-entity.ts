/**
 * Domain entity for a company's ERP integration mode. Pure data holder — the
 * read/write-allowed rules live in ErpIntegrationResolutionService, not here.
 */
import { Entity } from '@seltriva/core';

export type ErpIntegrationType = 'OFF' | 'ON';
export type ErpIntegrationStatus = 'ACTIVE' | 'INACTIVE';

export interface ErpIntegrationProps {
  readonly organizationId: string;
  readonly integrationType: ErpIntegrationType;
  readonly status: ErpIntegrationStatus;
  readonly erpName: string | null;
  readonly host: string | null;
  readonly database: string | null;
  readonly schema: string | null;
  readonly lastConnectionAt: Date | null;
  readonly lastSyncAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class ErpIntegrationEntity extends Entity<string> {
  private readonly props: ErpIntegrationProps;

  constructor(id: string, props: ErpIntegrationProps) {
    super(id);
    this.props = props;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get integrationType(): ErpIntegrationType {
    return this.props.integrationType;
  }

  get status(): ErpIntegrationStatus {
    return this.props.status;
  }

  get erpName(): string | null {
    return this.props.erpName;
  }

  get host(): string | null {
    return this.props.host;
  }

  get database(): string | null {
    return this.props.database;
  }

  get schema(): string | null {
    return this.props.schema;
  }

  get lastConnectionAt(): Date | null {
    return this.props.lastConnectionAt;
  }

  get lastSyncAt(): Date | null {
    return this.props.lastSyncAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
