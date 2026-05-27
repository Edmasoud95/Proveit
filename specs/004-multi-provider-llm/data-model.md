# Data Model: Multi-Provider LLM with Per-Task Model Routing

**Feature**: 004-multi-provider-llm  
**Date**: 2026-05-27

---

## Schema Changes

### Modified: `LlmConnection`

```prisma
model LlmConnection {
  id            String    @id @default(uuid())
  pocConfigId   String                           // CHANGED: was @unique, now plain FK
  name          String    @default("Default")    // NEW: display name
  isDefault     Boolean   @default(false)        // NEW: exactly one per POC must be true
  endpointUrl   String
  apiKey        String?
  model         String
  isActive      Boolean   @default(false)
  lastCheckedAt DateTime?
  availableModels String?                        // NEW: JSON array, cached after test

  pocConfig          PocConfig           @relation(fields: [pocConfigId], references: [id], onDelete: Cascade)
  taskModelOverrides TaskModelOverride[] // NEW: back-relation

  @@index([pocConfigId])                         // NEW: index for multi-row queries
}
```

**Field notes**:
- `name` — user-supplied display name (e.g., "LM Studio local", "OpenAI GPT-4o"). Defaults to "Default" for backward compat.
- `isDefault` — exactly one provider per POC should have `isDefault=true`. Enforced in service logic (not at DB level to avoid partial-update failures).
- `availableModels` — JSON string `string[]` populated on successful connection test. Allows model dropdowns in routing panel to work without requiring a live test each time.
- `pocConfigId` — the `@unique` constraint is **removed**. Prisma will recreate the table; existing rows are unaffected.

---

### New: `TaskModelOverride`

```prisma
model TaskModelOverride {
  id           String @id @default(uuid())
  pocConfigId  String
  taskType     String  // 'agent' | 'judge' | 'eval-gen' | 'stub-gen'
  connectionId String
  model        String

  pocConfig  PocConfig     @relation(fields: [pocConfigId], references: [id], onDelete: Cascade)
  connection LlmConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@unique([pocConfigId, taskType])
}
```

**Field notes**:
- `taskType` — one of the four task type string literals; validated at service layer.
- `connectionId` — FK to `LlmConnection`. `onDelete: Cascade` means deleting a provider automatically removes its task overrides (FR-009 "silently reverts to default").
- `model` — explicitly stored so the override captures the model in addition to the provider. The provider's default `model` field is used as a fallback only for the provider-level default.
- `@@unique([pocConfigId, taskType])` — at most one override per (POC, task type) pair.

---

### Modified: `PocConfig`

Add the new back-relations:

```prisma
model PocConfig {
  // ... existing fields unchanged ...
  llmConnections     LlmConnection[]    // CHANGED from `llmConnection LlmConnection?`
  taskModelOverrides TaskModelOverride[] // NEW
  // ... other existing relations unchanged ...
}
```

---

## Migration Strategy

### Step 1 — Schema migration

Prisma generates a migration that:
1. Recreates `LlmConnection` table without the `UNIQUE` constraint on `pocConfigId`.
2. Adds `name TEXT NOT NULL DEFAULT 'Default'` column.
3. Adds `isDefault INTEGER NOT NULL DEFAULT 0` column.
4. Adds `availableModels TEXT` column (nullable).
5. Adds `@@index([pocConfigId])`.
6. Creates `TaskModelOverride` table with all columns and constraints.

### Step 2 — Data migration (within the same migration file)

After table recreation, set all existing connections as defaults:

```sql
UPDATE "LlmConnection" SET "isDefault" = 1, "name" = 'Default';
```

This ensures every existing POC has a valid default provider immediately.

### Step 3 — `PocConfig` relation update

The `llmConnection LlmConnection?` relation on `PocConfig` becomes `llmConnections LlmConnection[]`. This is a Prisma client-level change only (no SQL needed); the FK column is on `LlmConnection`, not `PocConfig`.

---

## Service-Layer Invariants

1. **Exactly one default per POC** — enforced in `setDefault(pocId, connectionId)`: wraps a `prisma.$transaction` that sets `isDefault=false` on all connections for the POC, then sets `isDefault=true` on the target.
2. **Cannot delete the default provider** — `deleteProvider()` throws `BadRequestException` if the target has `isDefault=true` and other providers exist. If it's the only provider, deletion is allowed (empty state is valid per FR-009).
3. **Task override auto-cleared on provider deletion** — Prisma `onDelete: Cascade` on `TaskModelOverride.connectionId` handles this automatically.
4. **`resolveForTask` never returns null** — if no default exists (empty provider list), throws `NotFoundException` with a clear message directing the user to configure a provider (US3 AC-3).

---

## Shared Types Changes (`packages/shared/src/types.ts`)

```typescript
// Replace existing LlmConnection interface:
export interface LlmProvider {
  id: string;
  pocConfigId: string;
  name: string;
  isDefault: boolean;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
  availableModels?: string[];  // populated after successful test
}

export type TaskType = 'agent' | 'judge' | 'eval-gen' | 'stub-gen';

export interface TaskModelOverride {
  taskType: TaskType;
  connectionId: string;
  providerName: string;  // denormalized for display
  model: string;
}

export interface LlmRoutingConfig {
  providers: LlmProvider[];
  overrides: TaskModelOverride[];
}

// Keep LlmConnection for backward compat (returned by legacy shim endpoint):
export interface LlmConnection {
  id: string;
  pocConfigId: string;
  endpointUrl: string;
  model: string;
  isActive: boolean;
  lastCheckedAt?: string;
}
```
