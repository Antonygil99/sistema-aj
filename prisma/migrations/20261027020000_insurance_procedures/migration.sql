CREATE TABLE "InsuranceProcedure" (
  "id" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "clientId" TEXT NOT NULL, "policyId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "formId" TEXT NOT NULL DEFAULT 'metlife-cambios-gmm', "revision" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL, "sourceSnapshot" JSONB, "followUpDate" TIMESTAMP(3), "submissionReference" TEXT, "submittedAt" TIMESTAMP(3), "effectiveDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InsuranceProcedure_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProcedureRevision" (
  "id" TEXT NOT NULL, "procedureId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "status" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProcedureRevision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProcedureAttachment" (
  "id" TEXT NOT NULL, "procedureId" TEXT NOT NULL, "kind" TEXT NOT NULL, "documentId" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProcedureAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProcedureExport" (
  "id" TEXT NOT NULL, "procedureId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "storageKey" TEXT NOT NULL, "sha256" TEXT NOT NULL, "templateHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProcedureExport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InsuranceProcedure_requestKey_key" ON "InsuranceProcedure"("requestKey");
CREATE TABLE "InsuranceTemplate" ("id" TEXT NOT NULL, "sha256" TEXT NOT NULL, "pdfBytes" BYTEA NOT NULL, "code" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InsuranceTemplate_pkey" PRIMARY KEY ("id"));
CREATE INDEX "InsuranceProcedure_clientId_status_idx" ON "InsuranceProcedure"("clientId", "status");
CREATE INDEX "InsuranceProcedure_policyId_idx" ON "InsuranceProcedure"("policyId");
CREATE INDEX "InsuranceProcedure_followUpDate_status_idx" ON "InsuranceProcedure"("followUpDate", "status");
CREATE UNIQUE INDEX "ProcedureRevision_procedureId_revision_key" ON "ProcedureRevision"("procedureId", "revision");
CREATE UNIQUE INDEX "ProcedureAttachment_procedureId_kind_documentId_key" ON "ProcedureAttachment"("procedureId", "kind", "documentId");
CREATE UNIQUE INDEX "ProcedureExport_storageKey_key" ON "ProcedureExport"("storageKey");
CREATE UNIQUE INDEX "ProcedureExport_procedureId_revision_key" ON "ProcedureExport"("procedureId", "revision");
ALTER TABLE "InsuranceProcedure" ADD CONSTRAINT "InsuranceProcedure_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceProcedure" ADD CONSTRAINT "InsuranceProcedure_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcedureRevision" ADD CONSTRAINT "ProcedureRevision_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "InsuranceProcedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcedureAttachment" ADD CONSTRAINT "ProcedureAttachment_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "InsuranceProcedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcedureAttachment" ADD CONSTRAINT "ProcedureAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcedureExport" ADD CONSTRAINT "ProcedureExport_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "InsuranceProcedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
