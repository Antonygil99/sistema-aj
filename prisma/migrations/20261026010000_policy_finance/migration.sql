-- Preserve all existing contracts and payments. A new term may retain its real policy number.
CREATE UNIQUE INDEX "Policy_insurer_number_startDate_key" ON "Policy"("insurer", "number", "startDate");
DROP INDEX "Policy_number_key";
ALTER TABLE "Policy" ADD COLUMN "previousPolicyId" TEXT;
CREATE UNIQUE INDEX "Policy_previousPolicyId_key" ON "Policy"("previousPolicyId");
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_previousPolicyId_fkey" FOREIGN KEY ("previousPolicyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT, ADD COLUMN "evidenceDocumentId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
