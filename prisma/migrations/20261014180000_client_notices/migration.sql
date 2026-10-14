-- Fase 2 de correo: cola de avisos a clientes (renovación, pago, siniestro) y plantillas editables.
CREATE TYPE "NoticeStatus" AS ENUM ('PENDING', 'SENT', 'NOTIFIED', 'DISMISSED', 'EXPIRED');

CREATE TABLE "ClientNotice" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "policyId" TEXT,
    "paymentId" TEXT,
    "claimId" TEXT,
    "ownerEmail" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "NoticeStatus" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "note" TEXT,
    "emailId" TEXT,
    "resolvedByName" TEXT,
    "resolvedByEmail" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTemplate" (
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("kind")
);

CREATE UNIQUE INDEX "ClientNotice_dedupeKey_key" ON "ClientNotice"("dedupeKey");
CREATE INDEX "ClientNotice_status_ownerEmail_idx" ON "ClientNotice"("status", "ownerEmail");
CREATE INDEX "ClientNotice_clientId_idx" ON "ClientNotice"("clientId");

ALTER TABLE "ClientNotice" ADD CONSTRAINT "ClientNotice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
