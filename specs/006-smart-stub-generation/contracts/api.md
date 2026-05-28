# API Contract: Smart Stub Generation

## Existing Endpoint (extended)

### POST `/api/pocs/:pocId/tools/stubs/generate`

**Change**: Add optional `toolNames` filter to request body. All existing behavior unchanged when `toolNames` is omitted.

#### Request Body

```json
{
  "overwrite": true,
  "toolNames": ["search_web"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `overwrite` | `boolean` | No (default `false`) | If `true`, replace existing stubs. If `false`, skip tools that already have a stub. |
| `toolNames` | `string[]` | No | If provided, only generate stubs for these tool names. Ignored tools appear in `skipped`. |

#### Response Body (unchanged)

```json
{
  "generated": ["search_web"],
  "skipped": [],
  "failed": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `generated` | `string[]` | Tool names that received a new stub |
| `skipped` | `string[]` | Tool names that were not processed (already had a stub and `overwrite: false`, or not in `toolNames`) |
| `failed` | `string[]` | Tool names where LLM generation or parsing failed |

#### Behavior Matrix

| Scenario | `overwrite` | `toolNames` | Result |
|----------|-------------|-------------|--------|
| Bulk, empty-only | `false` | omitted | Generates stubs for tools with empty `mockResponse`; skips filled tools |
| Bulk, force-all | `true` | omitted | Generates stubs for all tools |
| Per-tool | `true` | `["tool_name"]` | Generates stub for the named tool only; skips all others |

#### Error Responses

| Status | Condition |
|--------|-----------|
| `404` | POC not found |
| `400` | `toolNames` present but empty array |
| `500` | LLM call failed entirely (not per-tool — those go in `failed[]`) |
