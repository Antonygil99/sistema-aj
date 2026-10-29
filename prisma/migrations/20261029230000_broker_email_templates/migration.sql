CREATE TABLE "BrokerEmailTemplate" ("id" TEXT NOT NULL PRIMARY KEY,"ownerEmail" TEXT NOT NULL,"name" TEXT NOT NULL,"kind" TEXT NOT NULL,"subject" TEXT NOT NULL,"body" TEXT NOT NULL,"defaultKind" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "BrokerEmailTemplate_ownerEmail_defaultKind_key" ON "BrokerEmailTemplate"("ownerEmail","defaultKind");
CREATE INDEX "BrokerEmailTemplate_ownerEmail_name_idx" ON "BrokerEmailTemplate"("ownerEmail","name");
