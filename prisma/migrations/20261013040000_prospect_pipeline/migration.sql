-- Old statuses map to the Ruta AJ stages: NEW/CONTACTED → CURIOSO, QUALIFIED → DIAGNOSTICADO, WON → CLIENTE, LOST → PERDIDO.
-- CreateEnum
CREATE TYPE "MedicalHistory" AS ENUM ('SI', 'NO', 'NO_SABE');

-- AlterEnum
BEGIN;
CREATE TYPE "ProspectStatus_new" AS ENUM ('CURIOSO', 'DIAGNOSTICADO', 'COMPARATIVO', 'EMISION', 'CLIENTE', 'PERDIDO');
ALTER TABLE "Prospect" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Prospect" ALTER COLUMN "status" TYPE "ProspectStatus_new" USING ((CASE "status"::text WHEN 'NEW' THEN 'CURIOSO' WHEN 'CONTACTED' THEN 'CURIOSO' WHEN 'QUALIFIED' THEN 'DIAGNOSTICADO' WHEN 'WON' THEN 'CLIENTE' WHEN 'LOST' THEN 'PERDIDO' ELSE "status"::text END)::"ProspectStatus_new");
ALTER TYPE "ProspectStatus" RENAME TO "ProspectStatus_old";
ALTER TYPE "ProspectStatus_new" RENAME TO "ProspectStatus";
DROP TYPE "ProspectStatus_old";
ALTER TABLE "Prospect" ALTER COLUMN "status" SET DEFAULT 'CURIOSO';
COMMIT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "convertedClientId" TEXT,
ADD COLUMN     "diagCare" TEXT,
ADD COLUMN     "diagCoverage" TEXT,
ADD COLUMN     "diagDependents" TEXT,
ADD COLUMN     "diagMedicalHistory" "MedicalHistory",
ADD COLUMN     "diagPain" TEXT,
ADD COLUMN     "diagProtect" TEXT,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "referredByClientId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'CURIOSO';

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_convertedClientId_key" ON "Prospect"("convertedClientId");

-- CreateIndex
CREATE INDEX "Prospect_ownerEmail_idx" ON "Prospect"("ownerEmail");

-- CreateIndex
CREATE INDEX "Prospect_referredByClientId_idx" ON "Prospect"("referredByClientId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_referredByClientId_fkey" FOREIGN KEY ("referredByClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

