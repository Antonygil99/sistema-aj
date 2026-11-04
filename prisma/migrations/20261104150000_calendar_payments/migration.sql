CREATE TABLE "CalendarPayment" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
 "generation" INTEGER NOT NULL DEFAULT 0, "fingerprint" TEXT NOT NULL DEFAULT '',
 "googleUrl" TEXT, "active" BOOLEAN NOT NULL DEFAULT false, "checkedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CalendarPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarPayment_userId_paymentId_key" ON "CalendarPayment"("userId", "paymentId");
CREATE INDEX "CalendarPayment_userId_active_idx" ON "CalendarPayment"("userId", "active");
