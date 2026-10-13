-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('MEDICAL', 'AUTO', 'LIFE', 'HOME', 'OTHER');

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryKnowsContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryKnowsFirstStep" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryKnowsWhenToNotify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryUnderstood" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "referralPotential" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "kind" TEXT,
ADD COLUMN     "ownerEmail" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "line" "ProductLine" NOT NULL DEFAULT 'MEDICAL',
    "description" TEXT,
    "highlights" TEXT,
    "ownerEmail" TEXT,
    "imageKey" TEXT,
    "imageType" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_imageKey_key" ON "Product"("imageKey");

-- CreateIndex
CREATE INDEX "Policy_productId_idx" ON "Policy"("productId");

-- CreateIndex
CREATE INDEX "Policy_ownerEmail_idx" ON "Policy"("ownerEmail");

-- CreateIndex
CREATE INDEX "Activity_ownerEmail_status_dueDate_idx" ON "Activity"("ownerEmail", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Activity_policyId_kind_idx" ON "Activity"("policyId", "kind");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

