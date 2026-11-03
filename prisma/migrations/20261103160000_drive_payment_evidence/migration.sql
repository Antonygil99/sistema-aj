ALTER TABLE "Payment" ADD COLUMN "evidenceDriveLinkId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_evidenceDriveLinkId_fkey" FOREIGN KEY ("evidenceDriveLinkId") REFERENCES "ClientDriveLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
