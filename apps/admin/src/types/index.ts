import type { LucideIcon } from 'lucide-react';

// ─── RBAC ───────────────────────────────────────────────────────────────────

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ATLAS_ADMIN'
  | 'SUPORTE'
  | 'CUSTOMER_SUCCESS'
  | 'COMERCIAL'
  | 'DEVOPS'
  | 'AUDITOR';

export type Permission =
  | 'companies.read'
  | 'companies.write'
  | 'companies.delete'
  | 'runtime.read'
  | 'runtime.restart'
  | 'runtime.update'
  | 'runtime.token'
  | 'marketplace.publish'
  | 'marketplace.review'
  | 'users.manage'
  | 'audit.read'
  | 'billing.manage'
  | 'settings.manage'
  | 'dashboard.view'
  | 'projects.read'
  | 'projects.write'
  | 'projects.delete';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: Permission[];
  avatarUrl?: string;
  active: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminSession {
  sub: string;
  role: AdminRole;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

// ─── Notifications & Alerts ───────────────────────────────────────────────────

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  createdAt: string;
  href?: string;
}

export type SystemAlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface SystemAlert {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  status: SystemAlertStatus;
  source: string;
  createdAt: string;
}
