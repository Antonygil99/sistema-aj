-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('PENDING', 'CONTACTED', 'RENEWED', 'LOST');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "premium" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "prospectId" TEXT,
    "clientId" TEXT,
    "product" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RenewalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "clientId" TEXT,
    "policyId" TEXT,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "prospectId" TEXT,
    "clientId" TEXT,
    "policyId" TEXT,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whatsapp',
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_status_createdAt_idx" ON "Prospect"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_number_key" ON "Policy"("number");

-- CreateIndex
CREATE INDEX "Policy_clientId_idx" ON "Policy"("clientId");

-- CreateIndex
CREATE INDEX "Policy_status_endDate_idx" ON "Policy"("status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_reference_key" ON "Quote"("reference");

-- CreateIndex
CREATE INDEX "Quote_prospectId_idx" ON "Quote"("prospectId");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX "Payment_policyId_idx" ON "Payment"("policyId");

-- CreateIndex
CREATE INDEX "Payment_status_dueDate_idx" ON "Payment"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Renewal_policyId_dueDate_idx" ON "Renewal"("policyId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_reference_key" ON "Claim"("reference");

-- CreateIndex
CREATE INDEX "Claim_policyId_status_idx" ON "Claim"("policyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_policyId_idx" ON "Document"("policyId");

-- CreateIndex
CREATE INDEX "Document_claimId_idx" ON "Document"("claimId");

-- CreateIndex
CREATE INDEX "Activity_status_dueDate_idx" ON "Activity"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Activity_prospectId_idx" ON "Activity"("prospectId");

-- CreateIndex
CREATE INDEX "Activity_clientId_idx" ON "Activity"("clientId");

-- CreateIndex
CREATE INDEX "Activity_policyId_idx" ON "Activity"("policyId");

-- CreateIndex
CREATE INDEX "Activity_claimId_idx" ON "Activity"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_payloadHash_key" ON "WebhookEvent"("payloadHash");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_createdAt_idx" ON "WebhookEvent"("processedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

