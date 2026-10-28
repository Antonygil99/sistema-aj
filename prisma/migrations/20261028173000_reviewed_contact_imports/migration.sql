-- CreateTable
CREATE TABLE "CrmImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT,
    "target" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceSha256" TEXT,
    "countryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceRef" TEXT,
    "data" JSONB NOT NULL,
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowNameMatch" BOOLEAN NOT NULL DEFAULT false,
    "reviewSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultId" TEXT,

    CONSTRAINT "CrmImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmImport_userId_status_createdAt_idx" ON "CrmImport"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmImportRow_batchId_rowNumber_key" ON "CrmImportRow"("batchId", "rowNumber");

-- AddForeignKey
ALTER TABLE "CrmImportRow" ADD CONSTRAINT "CrmImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CrmImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
