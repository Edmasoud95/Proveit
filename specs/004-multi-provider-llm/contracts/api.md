# API Contracts: Multi-Provider LLM with Per-Task Model Routing

**Feature**: 004-multi-provider-llm  
**Date**: 2026-05-27

---

## Provider Management

### GET `/api/pocs/:pocId/llm/providers`

Returns all configured LLM providers for a POC.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "pocConfigId": "uuid",
    "name": "LM Studio local",
    "isDefault": true,
    "endpointUrl": "http://localhost:1234/v1",
    "model": "llama-3.2-3b",
    "isActive": true,
    "lastCheckedAt": "2026-05-27T10:00:00Z",
    "availableModels": ["llama-3.2-3b", "qwen2.5-7b"]
  }
]
```

**Response 200 (no providers)**: `[]`

---

### POST `/api/pocs/:pocId/llm/providers`

Add a new provider. The first provider added is automatically set as default.

**Request body**:
```json
{
  "name": "OpenAI",
  "endpointUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o"
}
```

**Field rules**:
- `name`: required, string, max 100 chars
- `endpointUrl`: required, valid URL
- `apiKey`: optional
- `model`: required, string

**Response 201**: Full `LlmProvider` object (without `apiKey`).

**Response 400**: Validation error.

---

### PATCH `/api/pocs/:pocId/llm/providers/:id`

Update provider fields. All fields optional (partial update).

**Request body** (any subset):
```json
{
  "name": "OpenAI GPT-4o",
  "endpointUrl": "https://api.openai.com/v1",
  "apiKey": "sk-new-key",
  "model": "gpt-4o-mini"
}
```

**Response 200**: Updated `LlmProvider` object (without `apiKey`).

**Response 404**: Provider not found.

---

### DELETE `/api/pocs/:pocId/llm/providers/:id`

Delete a provider. Task overrides referencing this provider are automatically removed (cascade).

**Response 204**: No content.

**Response 400**:
```json
{
  "error": "CANNOT_DELETE_DEFAULT",
  "message": "Designate another provider as default before deleting this one."
}
```
Returned when deleting the default provider while other providers exist.

**Response 404**: Provider not found.

---

### POST `/api/pocs/:pocId/llm/providers/:id/test`

Test connectivity for a specific provider and fetch its available model list.

**Response 200**:
```json
{
  "status": "connected",
  "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  "latencyMs": 142
}
```

**Response 200 (failed)**:
```json
{
  "status": "failed",
  "error": "Connection refused: http://localhost:1234/v1"
}
```

Side effect: updates `isActive`, `lastCheckedAt`, and `availableModels` on the provider row.

---

### POST `/api/pocs/:pocId/llm/providers/:id/default`

Set a provider as the default. Atomically clears `isDefault` on all others.

**Response 200**: Updated `LlmProvider` object with `isDefault: true`.

**Response 404**: Provider not found.

---

## Task Routing

### GET `/api/pocs/:pocId/llm/routing`

Returns the current routing configuration — all task types with their active provider/model resolution.

**Response 200**:
```json
{
  "providers": [ /* same as GET /providers */ ],
  "overrides": [
    {
      "taskType": "judge",
      "connectionId": "uuid",
      "providerName": "OpenAI",
      "model": "gpt-4o"
    }
  ]
}
```

Tasks without an explicit override are not included in `overrides`; the caller infers "Default" for unlisted task types.

---

### PUT `/api/pocs/:pocId/llm/routing/:taskType`

Set or update the model routing override for a specific task type.

**Path param** `taskType`: one of `agent`, `judge`, `eval-gen`, `stub-gen`.

**Request body**:
```json
{
  "connectionId": "uuid",
  "model": "gpt-4o"
}
```

**Response 200**:
```json
{
  "taskType": "judge",
  "connectionId": "uuid",
  "providerName": "OpenAI",
  "model": "gpt-4o"
}
```

**Response 400**: Invalid `taskType` or provider not found for this POC.

---

### DELETE `/api/pocs/:pocId/llm/routing/:taskType`

Clear the routing override for a task type. The task will fall back to the default provider.

**Response 204**: No content.

**Response 404**: No override exists for this task type (idempotent delete returns 204 instead).

---

## Backward Compatibility Shim

### PUT `/api/pocs/:pocId/llm` *(existing — preserved)*

Upserts the default provider. Behavior:
- If no providers exist: creates one with `name='Default'`, `isDefault=true`.
- If a default provider exists: updates `endpointUrl`, `model`, `apiKey` on it.
- Non-default providers are unaffected.

**Request body** (unchanged):
```json
{
  "endpointUrl": "http://localhost:1234/v1",
  "model": "llama-3.2-3b",
  "apiKey": "optional"
}
```

**Response 200**: `LlmConnection` shape (legacy, without `name`/`isDefault` fields).

### GET `/api/pocs/:pocId/llm` *(existing — preserved)*

Returns the default provider in `LlmConnection` shape (legacy). Returns `null` if no providers configured.

### POST `/api/pocs/:pocId/llm/test` *(existing — preserved)*

Tests the default provider. Delegates to the default provider's test logic.

### GET `/api/pocs/:pocId/llm/models` *(existing — preserved)*

Returns models from the default provider.

---

## Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `CANNOT_DELETE_DEFAULT` | 400 | Cannot delete default while other providers exist |
| `INVALID_TASK_TYPE` | 400 | `taskType` not in `['agent','judge','eval-gen','stub-gen']` |
| `PROVIDER_NOT_IN_POC` | 400 | `connectionId` does not belong to this POC |
| `NO_DEFAULT_PROVIDER` | 404 | No default provider configured; task resolution failed |
