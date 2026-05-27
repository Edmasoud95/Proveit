# Research: Multi-Provider LLM with Per-Task Model Routing

**Feature**: 004-multi-provider-llm  
**Date**: 2026-05-27  
**Status**: Complete

---

## Decision 1: Schema Approach for Multiple Providers

**Decision**: Remove `@unique` from `LlmConnection.pocConfigId`, add `name String @default("Default")` and `isDefault Boolean @default(false)` fields. Add a separate `TaskModelOverride` table.

**Rationale**:
- Removing `@unique` converts the one-to-one relation to one-to-many, directly enabling multiple providers per POC.
- Prisma handles SQLite `@unique` removal via table recreation — existing rows are preserved unchanged.
- Migration script sets `name='Default'` and `isDefault=true` on all existing rows so they become the default provider automatically (backward compatibility, FR-010).
- `TaskModelOverride` as a separate table (not a JSON column in `PocConfig`) gives referential integrity: `onDelete: Cascade` on the connection FK auto-clears overrides when the provider is deleted (FR-009), no application logic required.
- `@@unique([pocConfigId, taskType])` ensures at most one override per task type per POC.

**Alternatives considered**:
- JSON column in `PocConfig` for routing config — rejected because FK integrity on `connectionId` is impossible with JSON.
- Separate `LlmProvider` model instead of extending `LlmConnection` — rejected because the existing model has all the right fields; renaming would require more migration churn for no gain.

---

## Decision 2: Task Routing Resolution Pattern

**Decision**: Add `resolveForTask(pocId: string, taskType: string): Promise<{ client: OpenAI; model: string; connectionId: string }>` to `LlmService`. Callers (`eval.service.ts`, `scaffold.service.ts`) call this instead of finding the connection directly.

**Rationale**:
- Single resolution point: task override → default provider. No duplication across callers.
- `OpenAI` client instances are stateless and cheap to construct — creating one per task call has negligible overhead.
- `connectionId` returned so callers can include it in run snapshots for audit trail.
- The fallback chain is simple enough (two steps) that a dedicated `resolveForTask` method is sufficient; no strategy pattern or plugin system needed (Principle V: Minimal Dependencies).

**Alternatives considered**:
- Caching `OpenAI` instances by connection ID — rejected because client creation is fast and caching adds complexity for no measurable benefit.
- Passing `resolveForTask` result through as a parameter vs. calling at use site — at-use-site wins because it keeps callers independent and avoids threading the result through multiple layers.

---

## Decision 3: Backward Compatibility Migration

**Decision**: Migration SQL sets `isDefault = 1` and `name = 'Default'` on all existing `LlmConnection` rows. No application-layer migration code needed.

**Rationale**:
- Prisma SQLite `ALTER TABLE` for adding non-nullable columns without defaults is handled via table recreation. The migration generates correct SQL.
- Setting `isDefault = 1` directly in the migration ensures every existing POC has a default provider the moment the schema is updated, with no risk of a "no default configured" error during a live transition.
- The application-layer `getConnection(pocId)` method can be kept as a compatibility shim (returns the `isDefault=true` provider) without any callers needing to change until they're ready to use the full multi-provider API.

**Alternatives considered**:
- Application-layer migration on first request — rejected because it creates a race condition window where `resolveForTask` could fail if called before migration runs.

---

## Decision 4: API Surface Design

**Decision**: Introduce a new `/pocs/:pocId/llm/providers` resource alongside the existing `/pocs/:pocId/llm` endpoint. Keep the old `PUT /pocs/:pocId/llm` working as a compat shim (upserts the default provider). New endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pocs/:pocId/llm/providers` | List all providers for a POC |
| POST | `/pocs/:pocId/llm/providers` | Add a new provider |
| PATCH | `/pocs/:pocId/llm/providers/:id` | Update a provider |
| DELETE | `/pocs/:pocId/llm/providers/:id` | Delete a provider |
| POST | `/pocs/:pocId/llm/providers/:id/test` | Test connectivity, fetch models |
| POST | `/pocs/:pocId/llm/providers/:id/default` | Set as default |
| GET | `/pocs/:pocId/llm/routing` | Get all task routing overrides |
| PUT | `/pocs/:pocId/llm/routing/:taskType` | Set or update a task override |
| DELETE | `/pocs/:pocId/llm/routing/:taskType` | Clear a task override |

**Rationale**:
- Keeping old `PUT /pocs/:pocId/llm` means the existing frontend `LlmConnect.tsx` continues to work before refactor (Principle SC-003).
- Provider-as-resource pattern (`/providers/:id`) maps cleanly to CRUD semantics and is easy to reason about.
- Routing as a sub-resource (`/routing/:taskType`) makes it clear that routing is configuration on the POC, not on the provider.

**Alternatives considered**:
- Single `PUT` endpoint that accepts the full provider+routing config — rejected because it creates large payloads and makes incremental saves impossible (poor UX for long forms).

---

## Decision 5: Frontend Structure

**Decision**: Rewrite `LlmConnect.tsx` in three sections:
1. **Provider list** — always visible; shows all configured providers with status badges and a default star.
2. **Add/Edit provider form** — inline slide-in or modal; shown when adding or editing a provider.
3. **Advanced model routing** — collapsible panel (collapsed by default); one row per task type with provider + model dropdowns.

**Rationale**:
- Progressive disclosure (Principle VII): the routing panel is collapsed so first-time users see the same simple interface as before.
- Provider list replaces the single-provider form — providers are now entities, so CRUD UI is appropriate.
- Each provider row has its own "Test" button to independently verify connectivity and fetch models.
- Model dropdowns in the routing panel are populated from the models fetched during the last successful test for that provider; if no test has been run, shows a text field instead.

**Alternatives considered**:
- Separate "Providers" page vs. inline on LlmConnect — inline wins because it keeps all LLM config in one place (Principle VI: UI/UX First).
- Global provider management (shared across POCs) — rejected per spec assumption: providers are scoped per POC.
