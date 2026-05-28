# Data Model: POC Config Version History

## New Model: `PocConfigVersion`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `String` | PK, uuid | |
| `pocConfigId` | `String` | FK → PocConfig, cascade delete | Owning POC |
| `versionNumber` | `Int` | NOT NULL | Monotonic integer, scoped per POC, starts at 1 |
| `systemPrompt` | `String` | NOT NULL | Full system prompt text at this version |
| `tools` | `String` | NOT NULL | JSON string of tool definitions array |
| `changeLabel` | `String` | NOT NULL | Human-readable summary: "Initial version", "System prompt changed", "Tools changed", "System prompt and tools changed", "Restored from vN" |
| `contentHash` | `String` | NOT NULL | SHA-256 of `systemPrompt + tools` for deduplication |
| `createdAt` | `DateTime` | default now() | |

**Indexes**: `@@index([pocConfigId])`, `@@unique([pocConfigId, versionNumber])`

## Modified Model: `PocConfig`

Add optional FK to current config version:

| New Field | Type | Description |
|-----------|------|-------------|
| `currentConfigVersionId` | `String?` | FK → PocConfigVersion (nullable, set null on delete) |

## Modified Model: `EvalRun`

Add config version reference (both ID for joins and number for display):

| New Field | Type | Default | Description |
|-----------|------|---------|-------------|
| `configVersionId` | `String?` | null | FK → PocConfigVersion (set null on delete) |
| `snapshotConfigVersionNumber` | `Int?` | null | Denormalized version number for display without join |

## Relationships

```
PocConfig  1 ──< N  PocConfigVersion   (one POC, many versions)
PocConfig  N >── 1  PocConfigVersion   (current version pointer, nullable)
EvalRun    N >── 1  PocConfigVersion   (run tagged with version, nullable)
```

## Shared Types (packages/shared/src/types.ts)

```typescript
export interface PocConfigVersion {
  id: string;
  pocConfigId: string;
  versionNumber: number;
  systemPrompt: string;
  tools: string;           // JSON string
  changeLabel: string;
  createdAt: string;
}

export interface PocConfigVersionSummary {
  id: string;
  versionNumber: number;
  changeLabel: string;
  createdAt: string;
  // systemPrompt and tools omitted — fetched individually for diff
}
```

Add to `EvalRun`:
```typescript
configVersionId?: string | null;
snapshotConfigVersionNumber?: number | null;
```

## Migration Strategy

SQLite migration adds:
1. `PocConfigVersion` table (new)
2. `PocConfig.currentConfigVersionId` nullable column
3. `EvalRun.configVersionId` nullable column
4. `EvalRun.snapshotConfigVersionNumber` nullable Int column

All new columns are nullable — zero data migration needed for existing rows.
