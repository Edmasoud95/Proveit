# API Contract: POC Config Version History

## New Endpoints

### GET `/api/pocs/:pocId/config-versions`

List all config versions for a POC in reverse-chronological order.

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "versionNumber": 3,
    "changeLabel": "System prompt changed",
    "createdAt": "2026-05-28T12:00:00Z"
  },
  {
    "id": "uuid",
    "versionNumber": 2,
    "changeLabel": "Tools changed",
    "createdAt": "2026-05-27T10:00:00Z"
  },
  {
    "id": "uuid",
    "versionNumber": 1,
    "changeLabel": "Initial version",
    "createdAt": "2026-05-26T09:00:00Z"
  }
]
```

Note: `systemPrompt` and `tools` content are **not** included in the list response (use the detail endpoint).

---

### GET `/api/pocs/:pocId/config-versions/:versionId`

Fetch a single config version's full content (for diff rendering).

**Response** `200`:
```json
{
  "id": "uuid",
  "versionNumber": 2,
  "systemPrompt": "You are a helpful assistant...",
  "tools": "[{\"name\":\"search\",...}]",
  "changeLabel": "Tools changed",
  "createdAt": "2026-05-27T10:00:00Z"
}
```

---

### POST `/api/pocs/:pocId/config-versions/:versionId/restore`

Restore the POC's system prompt and tools to the state of this version.

**Request body**: empty `{}`

**Response** `200`: the updated `PocConfig` (same shape as `GET /api/pocs/:pocId`)

**Side effect**: creates a new `PocConfigVersion` entry with `changeLabel: "Restored from vN"` where N is the restored version number.

**Error** `404`: version not found or does not belong to this POC.

---

## Modified Endpoints

### `GET /api/pocs/:pocId` (existing)

No shape change. The `currentConfigVersionId` field is internal — not exposed in the summary response. The frontend queries the config versions list separately.

### `GET /api/pocs/:pocId/evals/runs` (existing, inferred)

`EvalRun` response objects gain two optional fields:
```json
{
  "configVersionId": "uuid-or-null",
  "snapshotConfigVersionNumber": 3
}
```
These are `null` for runs created before this feature shipped.

### `GET /api/pocs/:pocId/evals/run/:runId` (existing detail)

Same addition as above.

## No Changes

- `POST /api/pocs/scaffold` — snapshot is created internally, not exposed
- `PATCH /api/pocs/:id` — snapshot is created internally after update, not exposed
- All LLM and eval case endpoints — unchanged
