CREATE TABLE "Insurer" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"normalizedName" TEXT NOT NULL,"description" TEXT,"imageKey" TEXT,"imageType" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Insurer_normalizedName_key" ON "Insurer"("normalizedName");
CREATE UNIQUE INDEX "Insurer_imageKey_key" ON "Insurer"("imageKey");
ALTER TABLE "Product" ADD COLUMN "insurerId" TEXT;
CREATE INDEX "Product_insurerId_idx" ON "Product"("insurerId");
INSERT INTO "Insurer" ("id","name","normalizedName","updatedAt") SELECT 'ins_'||md5(lower(regexp_replace(btrim("insurer"),'\s+',' ','g'))),min(regexp_replace(btrim("insurer"),'\s+',' ','g')),lower(regexp_replace(btrim("insurer"),'\s+',' ','g')),CURRENT_TIMESTAMP FROM "Product" WHERE btrim("insurer")<>'' GROUP BY lower(regexp_replace(btrim("insurer"),'\s+',' ','g'));
UPDATE "Product" p SET "insurerId"=i."id" FROM "Insurer" i WHERE i."normalizedName"=lower(regexp_replace(btrim(p."insurer"),'\s+',' ','g'));
ALTER TABLE "Product" ADD CONSTRAINT "Product_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
