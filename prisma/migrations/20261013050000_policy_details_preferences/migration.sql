-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "coverage" TEXT,
ADD COLUMN     "plates" TEXT,
ADD COLUMN     "vehicle" TEXT,
ADD COLUMN     "vehicleUse" TEXT;

-- CreateTable
CREATE TABLE "UserPreference" (
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("email")
);

