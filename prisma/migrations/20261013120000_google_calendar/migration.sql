CREATE TABLE "CalendarConnection" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "connectNonce" TEXT,
  "connectExpiresAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CalendarMeeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "activityId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "location" TEXT NOT NULL DEFAULT '',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "attendees" JSONB NOT NULL DEFAULT '[]',
  "reminderMinutes" INTEGER,
  "reminderMethod" TEXT NOT NULL DEFAULT 'popup',
  "useDefaultReminders" BOOLEAN NOT NULL DEFAULT false,
  "googleMeet" BOOLEAN NOT NULL DEFAULT false,
  "notifyGuests" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "googleEventId" TEXT NOT NULL,
  "googleUrl" TEXT,
  "meetUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarMeeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CalendarMeeting_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CalendarMeeting_googleEventId_key" ON "CalendarMeeting"("googleEventId");
CREATE INDEX "CalendarMeeting_userId_startAt_idx" ON "CalendarMeeting"("userId", "startAt");
CREATE INDEX "CalendarMeeting_activityId_idx" ON "CalendarMeeting"("activityId");
