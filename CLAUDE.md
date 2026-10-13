# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sistema AJ is an insurance CRM (Next.js 16 App Router, React 19, TypeScript, Prisma 7 + PostgreSQL, Better Auth with Google OAuth, Zod 4, Cloudflare R2 via the S3 SDK). The UI, README, docs, API error messages and test names are in **Spanish**; keep new user-facing text and docs in Spanish. Development is on Windows (PowerShell). Node >= 22.12.

## Commands

```powershell
npm run dev              # next dev on http://localhost:3000
npm run lint             # eslint (next core-web-vitals + typescript)
npm run typecheck        # prisma generate && next typegen && tsc --noEmit
npm test                 # tsx --test tests/*.test.ts && node --test tests/*.test.mjs
npm run check            # db:validate + lint + typecheck + test + build (full gate)
npx tsx --test tests/access-policy.test.ts           # single test file
npx tsx --test --test-name-pattern="WhatsApp" tests/architecture.test.ts   # single test
```

Database: `npm run db:up` / `db:down` (Docker Postgres from compose.yaml), `db:migrate` (dev migrations), `db:deploy` (prod), `db:seed` (idempotent fictitious data), `db:studio`. `npm run db:verify-deploy` (scripts/migrate-deploy.mjs) is the explicit hosted-DB deploy: it refuses DBs with foreign tables and no Prisma history, applies pending migrations, verifies app tables, and seeds initial access grants from `AJ_SUPERADMIN_EMAIL` / `AJ_ADMIN_EMAILS`. Never use `prisma db push` as a deploy strategy.

The Prisma client is generated into `src/generated/prisma` (git-ignored, lint-ignored) and imported as `@/generated/prisma/client`; run `npm run db:generate` after schema changes.

## Architecture

**CRM modules.** Nine modules (`prospectos, clientes, polizas, cotizaciones, pagos, renovaciones, siniestros, documentos, actividades`) each live in `src/modules/<slug>/` with `schema.ts` (strict Zod `createSchema`, built from helpers in `src/modules/shared/validation.ts`) and `service.ts`. Adding a module means updating `src/modules/catalog.ts`, `src/modules/registry.ts`, and the Prisma schema. The dynamic `/api/crm/[module]` route dispatches GET/list for any role and POST/create for ADMIN, except documents use verified upload. Prospects/clients also support search, detail and full-form PATCH through `/api/crm/[module]/[id]`, requiring `expectedUpdatedAt` for optimistic concurrency; omitted optional values are cleared. Other CRM services only list/create. There is no delete. Amounts are positive decimal strings (`Decimal(12,2)`), dates ISO 8601 with timezone, IDs are CUIDs.

**Auth and authorization.** `src/lib/auth.ts` builds Better Auth lazily (`getAuth()` returns null when env is incomplete → APIs answer 503 `AUTH_NOT_CONFIGURED`). Better Auth models are renamed (`authUser`, `authSession`, ...). Access is governed by `AccessGrant` rows (roles `USER < ADMIN < SUPERADMIN`) with pure logic in `src/lib/access-policy.ts` (unit tested; SUPERADMIN is only honored for the email in `AJ_SUPERADMIN_EMAIL`). Sign-up and session creation reject non-granted or unverified Google accounts.
- API routes call `authorize(request, minimumRole)` from `src/lib/api.ts` and return its response if set. It accepts either `Authorization: Bearer $AJ_API_TOKEN` (server-to-server, never SUPERADMIN) or a session cookie, in which case non-GET requests must have `Origin` equal to `BETTER_AUTH_URL`.
- Errors go through `apiError()` which maps Zod → 400, `P2002` → 409, `P2003` → 422, everything else → 503 without leaking details.
- Pages use `requireUser(minimum)` from `src/lib/session.ts`; the `(workspace)` route group layout enforces login for all CRM screens. `/usuarios` + `/api/users` are SUPERADMIN-only access management, with audited changes.

**Documents (R2).** Files are uploaded to a private R2 bucket via `POST /api/documents` (multipart, ADMIN) and downloaded via `/api/documents/[id]/download` (short-lived presigned URL). The generic CRM POST deliberately rejects `documentos` (`USE_DOCUMENT_UPLOAD`). Logic is split for testability: `file-policy.ts` (size/type validation, bounded form parsing) and `file-operations.ts` (pure orchestration against injected `DocumentRepository` / `FileStorage` interfaces) contain no `server-only` imports so `tests/documents.test.ts` can exercise them with in-memory fakes; `files.ts` and `src/integrations/r2/server.ts` wire in Prisma and R2. Never return bucket keys or permanent URLs to the browser.

**Server-only boundary.** Modules touching secrets, Prisma or auth import `'server-only'`. Code that tests import must stay free of it (tests run under plain `tsx`/`node --test`, not Next), so put testable logic in pure files and keep wiring in thin server-only wrappers. `getDb()` (`src/lib/db.ts`) is a global singleton using the `@prisma/adapter-pg` driver adapter and accepts the legacy `DATA_URL` alongside `DATABASE_URL`. Migration URL resolution (`DIRECT_URL`, or rewriting the Prisma Postgres `pooled.db.prisma.io` host) lives in `scripts/migration-url.mjs` and is shared by `prisma.config.ts` and the deploy script.

**WhatsApp and agents (scaffolding).** `/api/whatsapp/webhook` verifies `x-hub-signature-256` HMAC over the raw body and persists `WebhookEvent` rows deduplicated by `payloadHash`; no consumer/worker exists yet (`processedAt` stays null). `src/agents/catalog.ts` defines five agents with deterministic topic-based `selectAgent` (no LLM); `src/agents/runtime.ts` is only an `AgentRuntime` contract for a future eve adapter. Per docs/arquitectura.md: agents must never get direct Prisma or shell access, inbound WhatsApp/documents are untrusted data, and outbound actions require human approval. Do not invent "Método AJ" business rules; they await business documentation.

The dashboard metrics are illustrative placeholders, not real portfolio data.

## Further reading

- README.md: setup, env vars, API contract and error codes, hosted DB and Google OAuth configuration.
- docs/arquitectura.md: CRM flow, WhatsApp/AI pipeline, production hardening backlog.
- docs/documentos-r2.md: R2 document flow details, env var formats, error codes, and the documents backlog (4 MiB limit, no delete, per-record permissions).
- docs/CONTINUIDAD-SISTEMA-AJ.md: full agreed product scope, implementation status, service configuration and remaining work. Prospects/clients now have real capture/search/detail/edit screens; PATCH requires expectedUpdatedAt for optimistic concurrency. The dashboard still uses illustrative metrics.

Production runs on Vercel at https://crm.segurosaleyjoel.com (`BETTER_AUTH_URL` must match it exactly; pushing to `main` deploys).
