# Data Model: Smart Stub Generation

## Entities (unchanged)

### ToolDefinition (existing, `packages/shared/src/types.ts`)

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | `string` | Required, snake_case |
| `description` | `string` | Required |
| `parameters` | `Record<string, unknown>` | Required, JSON schema object |
| `mockResponse` | `string \| undefined` | Optional; empty = `undefined` or whitespace-only string |

**Empty rule**: `mockResponse` is considered empty if `!mockResponse || mockResponse.trim() === ''`.

No new fields. No schema migration needed.

## DTO Changes (backend)

### GenerateStubsDto (extended)

```typescript
class GenerateStubsDto {
  overwrite?: boolean;        // existing
  toolNames?: string[];       // NEW — if present, only generate for these tool names
}
```

**Validation**: `toolNames` is optional. If provided, must be a non-empty array of strings. If omitted, all eligible tools are processed.

## State Shape (frontend)

### GenerateStubsButton props (extended)

```typescript
interface GenerateStubsButtonProps {
  pocId: string;
  tools: ToolDefinition[];    // NEW — for computing empty count
}
```

Derived values (computed inline, not stored):
- `emptyCount = tools.filter(t => isEmpty(t.mockResponse)).length`
- `isDisabled = emptyCount === 0 || isLoading`

### ToolStubButton props (new component)

```typescript
interface ToolStubButtonProps {
  pocId: string;
  tool: ToolDefinition;
  onSuccess: (toolName: string, mockResponse: string) => void;
}
```

`onSuccess` is called with the generated stub so `ToolsEditor` can update its local draft state immediately (avoids re-fetch latency for a single field).

## API Response Shape (unchanged)

`GenerateStubsResult` — existing, no changes:
```typescript
interface GenerateStubsResult {
  generated: string[];
  skipped: string[];
  failed: string[];
}
```

For per-tool requests, `generated` will contain at most one entry (the requested tool name).
