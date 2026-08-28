-- CreateEnum
CREATE TYPE "RuntimeRegistrationStatus" AS ENUM ('PENDING', 'REGISTERED', 'ACTIVE', 'BLOCKED', 'REVOKED');

-- CreateTable
CREATE TABLE "RuntimeRegistration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "controlPlaneOrganizationId" TEXT,
    "machineFingerprintHash" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RuntimeRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "capabilities" TEXT[],
    "lastHeartbeat" TIMESTAMP(3),
    "lastHeartbeatSignature" TEXT,
    "lastMemoryMb" DOUBLE PRECISION,
    "lastCpuPercent" DOUBLE PRECISION,
    "lastUptimeSeconds" INTEGER,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeRegistration_machineFingerprintHash_key" ON "RuntimeRegistration"("machineFingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeRegistration_publicKey_key" ON "RuntimeRegistration"("publicKey");

-- CreateIndex
CREATE INDEX "RuntimeRegistration_organizationId_idx" ON "RuntimeRegistration"("organizationId");

-- CreateIndex
CREATE INDEX "RuntimeRegistration_controlPlaneOrganizationId_idx" ON "RuntimeRegistration"("controlPlaneOrganizationId");

-- CreateIndex
CREATE INDEX "RuntimeRegistration_status_idx" ON "RuntimeRegistration"("status");

-- AddForeignKey
ALTER TABLE "RuntimeRegistration" ADD CONSTRAINT "RuntimeRegistration_controlPlaneOrganizationId_fkey" FOREIGN KEY ("controlPlaneOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
