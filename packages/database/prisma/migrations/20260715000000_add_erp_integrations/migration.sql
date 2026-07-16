-- CreateEnum
CREATE TYPE "ErpIntegrationType" AS ENUM ('OFF', 'ON');

-- CreateEnum
CREATE TYPE "ErpIntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

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
CREATE UNIQUE INDEX "ErpIntegration_organizationId_key" ON "ErpIntegration"("organizationId");

-- CreateIndex
CREATE INDEX "ErpIntegration_integrationType_idx" ON "ErpIntegration"("integrationType");

-- CreateIndex
CREATE INDEX "ErpIntegration_status_idx" ON "ErpIntegration"("status");

-- AddForeignKey
ALTER TABLE "ErpIntegration" ADD CONSTRAINT "ErpIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
