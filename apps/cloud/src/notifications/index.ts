/**
 * @seltriva/cloud — notifications
 * Multi-channel notification engine: in-app, email, webhook, Slack.
 */

import type {
  OrganizationId,
  UserId,
  NotificationId,
  DomainResult,
  PaginatedResult,
} from '../domain/index';

export interface INotificationService {
  send(input: SendNotificationInput): Promise<DomainResult<void>>;
  sendBatch(inputs: SendNotificationInput[]): Promise<DomainResult<void>>;
  getForUser(
    userId: UserId,
    filter?: NotificationFilter
  ): Promise<PaginatedResult<NotificationView>>;
  markAsRead(notificationId: NotificationId, userId: UserId): Promise<DomainResult<void>>;
  markAllAsRead(userId: UserId, orgId: OrganizationId): Promise<DomainResult<void>>;
  getUnreadCount(userId: UserId): Promise<number>;
  registerWebhook(
    orgId: OrganizationId,
    config: WebhookConfig
  ): Promise<DomainResult<RegisteredWebhook>>;
  removeWebhook(webhookId: string, orgId: OrganizationId): Promise<DomainResult<void>>;
}

export interface SendNotificationInput {
  readonly organizationId?: OrganizationId;
  readonly recipientId?: UserId;
  readonly channels: NotificationChannel[];
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly category?: NotificationCategory;
  readonly priority?: NotificationPriority;
  readonly templateId?: string;
  readonly templateData?: Record<string, unknown>;
}

export type NotificationChannel = 'in-app' | 'email' | 'webhook' | 'slack';

export type NotificationCategory =
  | 'agent-status'
  | 'license'
  | 'security'
  | 'job'
  | 'invite'
  | 'system'
  | 'billing';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface NotificationView {
  readonly id: NotificationId;
  readonly title: string;
  readonly body: string;
  readonly category?: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly isRead: boolean;
  readonly data?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly readAt?: Date;
}

export interface NotificationFilter {
  readonly isRead?: boolean;
  readonly category?: NotificationCategory;
  readonly since?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface WebhookConfig {
  readonly url: string;
  readonly secret: string;
  readonly events: string[];
  readonly active?: boolean;
  readonly retries?: number;
  readonly timeoutMs?: number;
}

export interface RegisteredWebhook {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly url: string;
  readonly events: string[];
  readonly active: boolean;
  readonly createdAt: Date;
}

export const NOTIFICATION_TEMPLATES = {
  AGENT_OFFLINE: 'tpl-agent-offline',
  AGENT_DEGRADED: 'tpl-agent-degraded',
  LICENSE_EXPIRING: 'tpl-license-expiring',
  LICENSE_EXPIRED: 'tpl-license-expired',
  MEMBER_INVITED: 'tpl-member-invited',
  MEMBER_JOINED: 'tpl-member-joined',
  SECURITY_ALERT: 'tpl-security-alert',
  JOB_FAILED: 'tpl-job-failed',
  WELCOME: 'tpl-welcome',
} as const;
