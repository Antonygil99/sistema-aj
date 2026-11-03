ALTER TABLE "CalendarConnection" ADD COLUMN "renewalLeaseUntil" TIMESTAMP(3), ADD COLUMN "renewalLeaseToken" TEXT, ADD COLUMN "renewalLastRunAt" TIMESTAMP(3);
CREATE TABLE "CalendarRenewal" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "policyId" TEXT NOT NULL,
 "generation" INTEGER NOT NULL DEFAULT 0, "fingerprint" TEXT NOT NULL DEFAULT '',
 "googleUrl" TEXT, "active" BOOLEAN NOT NULL DEFAULT false, "checkedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CalendarRenewal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarRenewal_userId_policyId_key" ON "CalendarRenewal"("userId", "policyId");
CREATE INDEX "CalendarRenewal_userId_active_idx" ON "CalendarRenewal"("userId", "active");
