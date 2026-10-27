CREATE TABLE "ClientIntake" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "tokenHash" TEXT,
  "pinHash" TEXT,
  "expiresAt" TIMESTAMP(3),
  "accessHash" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "answers" JSONB,
  "approvedAnswers" JSONB,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientIntake_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClientIntake_clientId_key" ON "ClientIntake"("clientId");
CREATE UNIQUE INDEX "ClientIntake_tokenHash_key" ON "ClientIntake"("tokenHash");
CREATE UNIQUE INDEX "ClientIntake_accessHash_key" ON "ClientIntake"("accessHash");
CREATE TABLE "ClientIntakeRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "intakeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "answers" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "actorId" TEXT,
  "privacyVersion" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "ClientIntakeRevision_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ClientIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClientIntakeRevision_intakeId_revision_key" ON "ClientIntakeRevision"("intakeId", "revision");
