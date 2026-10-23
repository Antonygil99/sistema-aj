CREATE TABLE "WhatsAppConversation" (
 "id" TEXT NOT NULL, "phoneNumberId" TEXT NOT NULL, "contactId" TEXT NOT NULL,
 "displayName" TEXT NOT NULL, "lastMessageAt" TIMESTAMP(3) NOT NULL,
 "lastInboundAt" TIMESTAMP(3), "closed" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppConversation_phoneNumberId_contactId_key" ON "WhatsAppConversation"("phoneNumberId", "contactId");
CREATE INDEX "WhatsAppConversation_lastMessageAt_id_idx" ON "WhatsAppConversation"("lastMessageAt", "id");
CREATE TABLE "WhatsAppMessage" (
 "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "metaId" TEXT, "requestId" TEXT,
 "direction" TEXT NOT NULL, "kind" TEXT NOT NULL, "body" TEXT NOT NULL, "status" TEXT NOT NULL,
 "sentAt" TIMESTAMP(3) NOT NULL, "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3),
 "senderId" TEXT, "senderName" TEXT, "failureCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WhatsAppMessage_metaId_key" ON "WhatsAppMessage"("metaId");
CREATE UNIQUE INDEX "WhatsAppMessage_requestId_key" ON "WhatsAppMessage"("requestId");
CREATE INDEX "WhatsAppMessage_conversationId_sentAt_id_idx" ON "WhatsAppMessage"("conversationId", "sentAt", "id");
CREATE TABLE "WhatsAppReceipt" (
 "metaId" TEXT NOT NULL, "phoneNumberId" TEXT NOT NULL, "status" TEXT NOT NULL,
 "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3), "failureCode" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WhatsAppReceipt_pkey" PRIMARY KEY ("metaId")
);
