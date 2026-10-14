-- Carpetas de documentos: color elegido y archivado reversible.
ALTER TABLE "DocumentFolder" ADD COLUMN "color" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);
