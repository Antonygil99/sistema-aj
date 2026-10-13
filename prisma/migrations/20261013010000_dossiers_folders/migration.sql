ALTER TABLE "Policy" ADD COLUMN "paymentFrequency" TEXT;
CREATE TABLE "DocumentFolder" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "parentId" TEXT, "clientId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DocumentFolder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DocumentFolder_parentId_idx" ON "DocumentFolder"("parentId");
CREATE INDEX "DocumentFolder_clientId_idx" ON "DocumentFolder"("clientId");
CREATE UNIQUE INDEX "DocumentFolder_sibling_name" ON "DocumentFolder" (COALESCE("parentId", ''), COALESCE("clientId", ''), lower("name"));
ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
