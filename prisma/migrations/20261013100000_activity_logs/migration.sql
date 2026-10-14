ALTER TABLE "CrmEvent" ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorRole" "AccessRole",
  ADD COLUMN "details" JSONB,
  ADD COLUMN "auditOnly" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "CrmEvent_actorEmail_createdAt_idx" ON "CrmEvent"("actorEmail", "createdAt");
CREATE INDEX "CrmEvent_action_createdAt_idx" ON "CrmEvent"("action", "createdAt");

-- Recover identity for old events; their role at the time was not recorded.
UPDATE "CrmEvent" e SET "actorEmail" = u."email" FROM "AuthUser" u WHERE e."actorId" = u."id";
-- Preserve the existing access audit in the unified, superadmin-only history.
INSERT INTO "CrmEvent" ("id", "action", "module", "recordId", "label", "actorId", "actorName", "actorEmail", "details", "auditOnly", "createdAt")
SELECT 'access_' || a."id", 'access_changed', 'usuarios', a."targetEmail", a."targetEmail", a."actorId", u."name", u."email", a."change", true, a."createdAt"
FROM "AccessAudit" a JOIN "AuthUser" u ON u."id" = a."actorId";
