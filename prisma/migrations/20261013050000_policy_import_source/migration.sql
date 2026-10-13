-- Additive provenance for imported insurance details; preserves existing policies and payments.
ALTER TABLE "Policy" ADD COLUMN "sourceData" JSONB;
