ALTER TYPE "ProductLine" ADD VALUE IF NOT EXISTS 'TRAVEL';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'INFORMACION_RECIBIDA';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'PROPUESTA_ENVIADA';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'DOCUMENTACION';
ALTER TABLE "AccessGrant" ADD COLUMN "productLines" "ProductLine"[] NOT NULL DEFAULT ARRAY[]::"ProductLine"[];
ALTER TABLE "Prospect"
 ADD COLUMN "line" "ProductLine" NOT NULL DEFAULT 'MEDICAL',
 ADD COLUMN "clientId" TEXT,
 ADD COLUMN "sex" TEXT,
 ADD COLUMN "age" INTEGER,
 ADD COLUMN "postalCode" TEXT,
 ADD COLUMN "vehicle" TEXT,
 ADD COLUMN "paymentFrequency" TEXT,
 ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_age_check" CHECK ("age" IS NULL OR "age" BETWEEN 0 AND 120);
CREATE INDEX "Prospect_line_status_archivedAt_idx" ON "Prospect"("line","status","archivedAt");
CREATE INDEX "Prospect_clientId_idx" ON "Prospect"("clientId");
DROP INDEX "Prospect_convertedClientId_key";
CREATE INDEX "Prospect_convertedClientId_idx" ON "Prospect"("convertedClientId");
ALTER TABLE "Policy" ADD COLUMN "line" "ProductLine";
ALTER TABLE "Quote" ADD COLUMN "line" "ProductLine";
CREATE INDEX "Policy_line_idx" ON "Policy"("line");
CREATE INDEX "Quote_line_idx" ON "Quote"("line");
-- Prefer the actual catalog binding. Do not assign an ambiguous legacy policy to a broker.
UPDATE "Policy" p SET "line"=c."line" FROM "Product" c WHERE p."productId"=c.id;
UPDATE "Policy" SET "line"=CASE
 WHEN translate(upper(product),'ÁÉÍÓÚ','AEIOU') ~ '(GASTOS MEDICOS|\mGMM\M|MEDICA)' THEN 'MEDICAL'::"ProductLine"
 WHEN translate(upper(product),'ÁÉÍÓÚ','AEIOU') ~ '(\mAUTO|AUTOMOVIL)' OR nullif(trim(vehicle),'') IS NOT NULL THEN 'AUTO'::"ProductLine"
 WHEN upper(product) ~ '\mVIDA\M' THEN 'LIFE'::"ProductLine"
 WHEN upper(product) ~ '(\mHOGAR\M|\mCASA\M)' THEN 'HOME'::"ProductLine"
 ELSE NULL END WHERE "line" IS NULL;
UPDATE "Quote" q SET "line"=p."line" FROM "Prospect" p WHERE q."prospectId"=p.id;

ALTER TABLE "CrmImport" ADD COLUMN "line" "ProductLine";
