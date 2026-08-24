-- CreateEnum
CREATE TYPE "AtlasAgentStatus" AS ENUM ('REGISTERING', 'ONLINE', 'OFFLINE', 'SYNCING', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrganizationTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "EnvironmentKind" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNRESPONSIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'TRIAL', 'PENDING');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('SCHEMA_SYNC', 'INCREMENTAL_SYNC', 'HEALTH_CHECK', 'TELEMETRY_FLUSH', 'NOTIFICATION', 'AUDIT_EXPORT', 'REPORT_GENERATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WEBHOOK', 'SLACK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'INVITE', 'ACCEPT_INVITE', 'REVOKE_ACCESS', 'ACTIVATE', 'SUSPEND', 'ROTATE_KEY', 'INSTALL_PLUGIN', 'UNINSTALL_PLUGIN', 'REGISTER_AGENT', 'DEREGISTER_AGENT', 'APPLY_UPDATE');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FeatureFlagKind" AS ENUM ('BOOLEAN', 'PERCENTAGE', 'VARIANT');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CHURNED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "HealthCheckStatus" AS ENUM ('PASS', 'WARN', 'FAIL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('RUNTIME_OFFLINE', 'HIGH_CPU', 'HIGH_MEMORY', 'SYNC_FAILURE', 'CONNECTOR_STOPPED', 'DEPLOY_FAILED', 'TOKEN_EXPIRING');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationChannelKind" AS ENUM ('EMAIL', 'WEBSOCKET', 'SLACK', 'TEAMS', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "FleetNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "DeploymentMode" AS ENUM ('MANUAL', 'AUTOMATIC', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DeploymentJobStatus" AS ENUM ('PENDING_APPROVAL', 'SCHEDULED', 'APPROVED', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'REJECTED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ErpIntegrationType" AS ENUM ('OFF', 'ON');

-- CreateEnum
CREATE TYPE "ErpIntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "AtlasAgent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "AtlasAgentStatus" NOT NULL DEFAULT 'REGISTERING',
    "lastHeartbeat" TIMESTAMP(3),
    "lastSynchronization" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AtlasAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAccessToken" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningToken" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisioningToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasAgentHeartbeat" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "memoryUsage" INTEGER,
    "uptime" INTEGER,
    "queueSize" INTEGER,
    "status" TEXT NOT NULL,

    CONSTRAINT "AtlasAgentHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasAgentSyncHistory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "recordsSent" INTEGER NOT NULL,
    "recordsFailed" INTEGER NOT NULL,
    "bytesTransferred" INTEGER NOT NULL,
    "compressionRatio" DOUBLE PRECISION,
    "result" TEXT NOT NULL,

    CONSTRAINT "AtlasAgentSyncHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ActivationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasAdminRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasPermission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "AtlasRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AtlasAdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AtlasAdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasAdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasLoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasAdminAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "primaryContactEmail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "OrganizationTier" NOT NULL DEFAULT 'FREE',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "logoUrl" TEXT,
    "metadata" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'VIEWER',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "inviteToken" TEXT,
    "inviteExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "EnvironmentKind" NOT NULL DEFAULT 'DEVELOPMENT',
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "platform" TEXT,
    "arch" TEXT,
    "nodeVersion" TEXT,
    "capabilities" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentHeartbeat" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "cpuPct" DOUBLE PRECISION,
    "memPct" DOUBLE PRECISION,
    "diskPct" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "version" TEXT,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTelemetryLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTelemetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCommand" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "AgentCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "status" "PluginStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "homepage" TEXT,
    "repository" TEXT,
    "iconUrl" TEXT,
    "readme" TEXT,
    "manifest" JSONB NOT NULL,
    "schema" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginVersion" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "manifest" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPlugin" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tier" "OrganizationTier" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxAgents" INTEGER NOT NULL DEFAULT 5,
    "maxWorkspaces" INTEGER NOT NULL DEFAULT 3,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "features" TEXT[],
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "environmentId" TEXT,
    "key" TEXT NOT NULL,
    "kind" "FeatureFlagKind" NOT NULL DEFAULT 'BOOLEAN',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER,
    "variants" JSONB,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "kind" "JobKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "recipientId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT,
    "kind" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "labels" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeHealthSnapshot" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "HealthCheckStatus" NOT NULL,
    "checks" JSONB NOT NULL,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT,
    "pluginId" TEXT,
    "deploymentId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RuntimeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetNotification" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannelKind" NOT NULL,
    "target" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "relatedAlertId" TEXT,
    "status" "FleetNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "FleetNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "mode" "DeploymentMode" NOT NULL,
    "status" "DeploymentJobStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "scheduledAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentTask" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationType" "ErpIntegrationType" NOT NULL DEFAULT 'OFF',
    "status" "ErpIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "erpName" TEXT,
    "host" TEXT,
    "database" TEXT,
    "schema" TEXT,
    "lastConnectionAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtlasAgent_machineId_key" ON "AtlasAgent"("machineId");

-- CreateIndex
CREATE INDEX "AtlasAgent_companyId_idx" ON "AtlasAgent"("companyId");

-- CreateIndex
CREATE INDEX "AtlasAgent_status_idx" ON "AtlasAgent"("status");

-- CreateIndex
CREATE INDEX "AtlasAgent_companyId_status_idx" ON "AtlasAgent"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAccessToken_tokenHash_key" ON "AgentAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentAccessToken_agentId_idx" ON "AgentAccessToken"("agentId");

-- CreateIndex
CREATE INDEX "AgentAccessToken_tokenPrefix_idx" ON "AgentAccessToken"("tokenPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningToken_tokenHash_key" ON "ProvisioningToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ProvisioningToken_companyId_idx" ON "ProvisioningToken"("companyId");

-- CreateIndex
CREATE INDEX "ProvisioningToken_tokenPrefix_idx" ON "ProvisioningToken"("tokenPrefix");

-- CreateIndex
CREATE INDEX "AtlasAgentHeartbeat_agentId_idx" ON "AtlasAgentHeartbeat"("agentId");

-- CreateIndex
CREATE INDEX "AtlasAgentHeartbeat_agentId_receivedAt_idx" ON "AtlasAgentHeartbeat"("agentId", "receivedAt");

-- CreateIndex
CREATE INDEX "AtlasAgentHeartbeat_receivedAt_idx" ON "AtlasAgentHeartbeat"("receivedAt");

-- CreateIndex
CREATE INDEX "AtlasAgentSyncHistory_agentId_idx" ON "AtlasAgentSyncHistory"("agentId");

-- CreateIndex
CREATE INDEX "AtlasAgentSyncHistory_agentId_finishedAt_idx" ON "AtlasAgentSyncHistory"("agentId", "finishedAt");

-- CreateIndex
CREATE INDEX "AtlasAgentSyncHistory_finishedAt_idx" ON "AtlasAgentSyncHistory"("finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationToken_token_key" ON "ActivationToken"("token");

-- CreateIndex
CREATE INDEX "ActivationToken_token_idx" ON "ActivationToken"("token");

-- CreateIndex
CREATE INDEX "ActivationToken_companyId_idx" ON "ActivationToken"("companyId");

-- CreateIndex
CREATE INDEX "ActivationToken_expiresAt_idx" ON "ActivationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasAdminRole_name_key" ON "AtlasAdminRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasPermission_resource_action_key" ON "AtlasPermission"("resource", "action");

-- CreateIndex
CREATE INDEX "AtlasRolePermission_permissionId_idx" ON "AtlasRolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasAdminUser_email_key" ON "AtlasAdminUser"("email");

-- CreateIndex
CREATE INDEX "AtlasAdminUser_roleId_idx" ON "AtlasAdminUser"("roleId");

-- CreateIndex
CREATE INDEX "AtlasAdminUser_email_idx" ON "AtlasAdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasAdminSession_refreshTokenHash_key" ON "AtlasAdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AtlasAdminSession_adminUserId_idx" ON "AtlasAdminSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AtlasAdminSession_refreshTokenHash_idx" ON "AtlasAdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AtlasLoginAttempt_email_ip_createdAt_idx" ON "AtlasLoginAttempt"("email", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "AtlasAdminAuditLog_action_idx" ON "AtlasAdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AtlasAdminAuditLog_actorId_idx" ON "AtlasAdminAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AtlasAdminAuditLog_createdAt_idx" ON "AtlasAdminAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_tier_idx" ON "Organization"("tier");

-- CreateIndex
CREATE INDEX "Organization_tenantId_idx" ON "Organization"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_inviteToken_key" ON "OrganizationMember"("inviteToken");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Workspace_organizationId_idx" ON "Workspace"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_organizationId_slug_key" ON "Workspace"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Environment_workspaceId_idx" ON "Environment"("workspaceId");

-- CreateIndex
CREATE INDEX "Environment_kind_idx" ON "Environment"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_workspaceId_slug_key" ON "Environment"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Agent_organizationId_idx" ON "Agent"("organizationId");

-- CreateIndex
CREATE INDEX "Agent_environmentId_idx" ON "Agent"("environmentId");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_lastSeenAt_idx" ON "Agent"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AgentHeartbeat_agentId_idx" ON "AgentHeartbeat"("agentId");

-- CreateIndex
CREATE INDEX "AgentHeartbeat_receivedAt_idx" ON "AgentHeartbeat"("receivedAt");

-- CreateIndex
CREATE INDEX "AgentTelemetryLog_agentId_idx" ON "AgentTelemetryLog"("agentId");

-- CreateIndex
CREATE INDEX "AgentTelemetryLog_kind_idx" ON "AgentTelemetryLog"("kind");

-- CreateIndex
CREATE INDEX "AgentTelemetryLog_receivedAt_idx" ON "AgentTelemetryLog"("receivedAt");

-- CreateIndex
CREATE INDEX "AgentCommand_agentId_idx" ON "AgentCommand"("agentId");

-- CreateIndex
CREATE INDEX "AgentCommand_commandType_idx" ON "AgentCommand"("commandType");

-- CreateIndex
CREATE INDEX "AgentCommand_issuedAt_idx" ON "AgentCommand"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_slug_key" ON "Plugin"("slug");

-- CreateIndex
CREATE INDEX "Plugin_slug_idx" ON "Plugin"("slug");

-- CreateIndex
CREATE INDEX "Plugin_status_idx" ON "Plugin"("status");

-- CreateIndex
CREATE INDEX "Plugin_category_idx" ON "Plugin"("category");

-- CreateIndex
CREATE INDEX "PluginVersion_pluginId_idx" ON "PluginVersion"("pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "PluginVersion_pluginId_version_key" ON "PluginVersion"("pluginId", "version");

-- CreateIndex
CREATE INDEX "Deployment_organizationId_idx" ON "Deployment"("organizationId");

-- CreateIndex
CREATE INDEX "Deployment_environmentId_idx" ON "Deployment"("environmentId");

-- CreateIndex
CREATE INDEX "Deployment_pluginId_idx" ON "Deployment"("pluginId");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "OrganizationPlugin_organizationId_idx" ON "OrganizationPlugin"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPlugin_pluginId_idx" ON "OrganizationPlugin"("pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPlugin_organizationId_pluginId_key" ON "OrganizationPlugin"("organizationId", "pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");

-- CreateIndex
CREATE INDEX "License_organizationId_idx" ON "License"("organizationId");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE INDEX "License_expiresAt_idx" ON "License"("expiresAt");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_organizationId_idx" ON "FeatureFlag"("organizationId");

-- CreateIndex
CREATE INDEX "FeatureFlag_environmentId_idx" ON "FeatureFlag"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_organizationId_environmentId_key_key" ON "FeatureFlag"("organizationId", "environmentId", "key");

-- CreateIndex
CREATE INDEX "Configuration_workspaceId_idx" ON "Configuration"("workspaceId");

-- CreateIndex
CREATE INDEX "Configuration_key_idx" ON "Configuration"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_workspaceId_key_key" ON "Configuration"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "Job_organizationId_idx" ON "Job"("organizationId");

-- CreateIndex
CREATE INDEX "Job_kind_idx" ON "Job"("kind");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_scheduledAt_idx" ON "Job"("scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "AuditEntry_organizationId_idx" ON "AuditEntry"("organizationId");

-- CreateIndex
CREATE INDEX "AuditEntry_actorId_idx" ON "AuditEntry"("actorId");

-- CreateIndex
CREATE INDEX "AuditEntry_action_idx" ON "AuditEntry"("action");

-- CreateIndex
CREATE INDEX "AuditEntry_resource_idx" ON "AuditEntry"("resource");

-- CreateIndex
CREATE INDEX "AuditEntry_occurredAt_idx" ON "AuditEntry"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "ApiKey_status_idx" ON "ApiKey"("status");

-- CreateIndex
CREATE INDEX "MetricSnapshot_organizationId_idx" ON "MetricSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_agentId_idx" ON "MetricSnapshot"("agentId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_kind_idx" ON "MetricSnapshot"("kind");

-- CreateIndex
CREATE INDEX "MetricSnapshot_recordedAt_idx" ON "MetricSnapshot"("recordedAt");

-- CreateIndex
CREATE INDEX "RuntimeHealthSnapshot_agentId_idx" ON "RuntimeHealthSnapshot"("agentId");

-- CreateIndex
CREATE INDEX "RuntimeHealthSnapshot_recordedAt_idx" ON "RuntimeHealthSnapshot"("recordedAt");

-- CreateIndex
CREATE INDEX "RuntimeLog_agentId_idx" ON "RuntimeLog"("agentId");

-- CreateIndex
CREATE INDEX "RuntimeLog_level_idx" ON "RuntimeLog"("level");

-- CreateIndex
CREATE INDEX "RuntimeLog_createdAt_idx" ON "RuntimeLog"("createdAt");

-- CreateIndex
CREATE INDEX "RuntimeAlert_organizationId_idx" ON "RuntimeAlert"("organizationId");

-- CreateIndex
CREATE INDEX "RuntimeAlert_agentId_idx" ON "RuntimeAlert"("agentId");

-- CreateIndex
CREATE INDEX "RuntimeAlert_type_idx" ON "RuntimeAlert"("type");

-- CreateIndex
CREATE INDEX "RuntimeAlert_severity_idx" ON "RuntimeAlert"("severity");

-- CreateIndex
CREATE INDEX "RuntimeAlert_status_idx" ON "RuntimeAlert"("status");

-- CreateIndex
CREATE INDEX "FleetNotification_channel_idx" ON "FleetNotification"("channel");

-- CreateIndex
CREATE INDEX "FleetNotification_status_idx" ON "FleetNotification"("status");

-- CreateIndex
CREATE INDEX "FleetNotification_relatedAlertId_idx" ON "FleetNotification"("relatedAlertId");

-- CreateIndex
CREATE INDEX "DeploymentJob_organizationId_idx" ON "DeploymentJob"("organizationId");

-- CreateIndex
CREATE INDEX "DeploymentJob_environmentId_idx" ON "DeploymentJob"("environmentId");

-- CreateIndex
CREATE INDEX "DeploymentJob_status_idx" ON "DeploymentJob"("status");

-- CreateIndex
CREATE INDEX "DeploymentJob_scheduledAt_idx" ON "DeploymentJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "DeploymentTask_jobId_idx" ON "DeploymentTask"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpIntegration_organizationId_key" ON "ErpIntegration"("organizationId");

-- CreateIndex
CREATE INDEX "ErpIntegration_integrationType_idx" ON "ErpIntegration"("integrationType");

-- CreateIndex
CREATE INDEX "ErpIntegration_status_idx" ON "ErpIntegration"("status");

-- AddForeignKey
ALTER TABLE "AtlasRolePermission" ADD CONSTRAINT "AtlasRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AtlasAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasRolePermission" ADD CONSTRAINT "AtlasRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AtlasPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasAdminUser" ADD CONSTRAINT "AtlasAdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AtlasAdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasAdminSession" ADD CONSTRAINT "AtlasAdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AtlasAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentHeartbeat" ADD CONSTRAINT "AgentHeartbeat_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTelemetryLog" ADD CONSTRAINT "AgentTelemetryLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCommand" ADD CONSTRAINT "AgentCommand_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plugin" ADD CONSTRAINT "Plugin_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginVersion" ADD CONSTRAINT "PluginVersion_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "PluginVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlugin" ADD CONSTRAINT "OrganizationPlugin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlugin" ADD CONSTRAINT "OrganizationPlugin_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeHealthSnapshot" ADD CONSTRAINT "RuntimeHealthSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeLog" ADD CONSTRAINT "RuntimeLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeAlert" ADD CONSTRAINT "RuntimeAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentJob" ADD CONSTRAINT "DeploymentJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentJob" ADD CONSTRAINT "DeploymentJob_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentJob" ADD CONSTRAINT "DeploymentJob_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentJob" ADD CONSTRAINT "DeploymentJob_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "PluginVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTask" ADD CONSTRAINT "DeploymentTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeploymentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpIntegration" ADD CONSTRAINT "ErpIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
