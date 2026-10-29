CREATE TABLE "WhatsAppChannel" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "ownerEmail" TEXT NOT NULL,
  "phoneNumberId" TEXT, "wabaId" TEXT, "credentialSlot" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "WhatsAppChannel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppChannel_phoneNumberId_key" ON "WhatsAppChannel"("phoneNumberId");
CREATE UNIQUE INDEX "WhatsAppChannel_credentialSlot_key" ON "WhatsAppChannel"("credentialSlot");
CREATE INDEX "WhatsAppChannel_ownerEmail_enabled_idx" ON "WhatsAppChannel"("ownerEmail", "enabled");
CREATE TABLE "RenewalPreparation" (
  "id" TEXT NOT NULL, "policyId" TEXT NOT NULL, "data" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARING', "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RenewalPreparation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RenewalPreparation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RenewalPreparation_policyId_key" ON "RenewalPreparation"("policyId");
CREATE TABLE "CrmResourceLink" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "category" TEXT NOT NULL, "insurer" TEXT,
  "url" TEXT NOT NULL, "audience" TEXT NOT NULL DEFAULT 'INTERNAL', "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true, "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmResourceLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CrmResourceLink_audience_active_idx" ON "CrmResourceLink"("audience", "active");
