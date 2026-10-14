-- Capa de correo (Resend): contactos adicionales por cliente y registro de cada correo enviado o programado.
CREATE TYPE "EmailStatus" AS ENUM ('SENDING', 'SCHEDULED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELLED');

CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "resendId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENDING',
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "replyTo" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "clientId" TEXT,
    "meetingId" TEXT,
    "recordModule" TEXT,
    "recordId" TEXT,
    "sentByName" TEXT NOT NULL,
    "sentByEmail" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");
CREATE UNIQUE INDEX "EmailMessage_dedupeKey_key" ON "EmailMessage"("dedupeKey");
CREATE UNIQUE INDEX "EmailMessage_resendId_key" ON "EmailMessage"("resendId");
CREATE INDEX "EmailMessage_clientId_createdAt_idx" ON "EmailMessage"("clientId", "createdAt");
CREATE INDEX "EmailMessage_meetingId_idx" ON "EmailMessage"("meetingId");
CREATE INDEX "EmailMessage_kind_createdAt_idx" ON "EmailMessage"("kind", "createdAt");

ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CalendarMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
