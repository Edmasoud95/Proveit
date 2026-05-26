# API Contracts: Proveit Backend

**Feature**: 001-project-scaffolding
**Date**: 2026-05-26

## Base URL

`http://localhost:3000/api`

---

## POC Config Endpoints

### `POST /pocs`
Create a new POC by scaffolding from a workflow description.

**Request**:
```json
{
  "description": "string (the workflow description in plain text)"
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "systemPrompt": "string",
  "tools": [{ "name": "string", "description": "string", "parameters": {} }],
  "evalCases": [{ "id": "uuid", "name": "string", "input": {}, "judgeCriteria": "string" }],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### `GET /pocs`
List all POC configs.

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
]
```

---

### `GET /pocs/:id`
Get full POC config with all details.

**Response** `200`: Full POC object (same as POST response)

---

### `PATCH /pocs/:id`
Update POC config fields.

**Request** (partial):
```json
{
  "name": "string?",
  "systemPrompt": "string?",
  "tools": "array?"
}
```

**Response** `200`: Updated full POC object

---

### `DELETE /pocs/:id`
Delete a POC and all associated data.

**Response** `204`: No content

---

### `GET /pocs/:id/export`
Export POC config as portable JSON file.

**Response** `200`:
```json
{
  "version": "1",
  "exportedAt": "datetime",
  "poc": { "...full config..." }
}
```
Headers: `Content-Disposition: attachment; filename="poc-name.json"`

---

## Eval Endpoints

### `POST /pocs/:id/evals`
Add eval cases (manual or import).

**Request**:
```json
{
  "cases": [
    { "name": "string", "input": {}, "judgeCriteria": "string" }
  ]
}
```

**Response** `201`:
```json
{
  "cases": [{ "id": "uuid", "name": "string", "input": {}, "judgeCriteria": "string", "order": 0 }]
}
```

---

### `POST /pocs/:id/evals/generate`
AI-generate additional eval cases from current config.

**Request**:
```json
{
  "count": 5
}
```

**Response** `201`: Same as POST /pocs/:id/evals

---

### `POST /pocs/:id/evals/run`
Execute all eval cases against connected LLM. Returns run ID for SSE stream.

**Response** `202`:
```json
{
  "runId": "uuid",
  "totalCases": 5,
  "status": "pending"
}
```

---

### `GET /pocs/:id/evals/run/:runId/stream`
SSE stream of eval results as they complete.

**Response**: `text/event-stream`
```
event: case-start
data: {"caseId": "uuid", "name": "string"}

event: case-complete
data: {"caseId": "uuid", "status": "passed|failed", "score": 8, "reasoning": "string", "latencyMs": 1200}

event: run-complete
data: {"runId": "uuid", "passed": 4, "failed": 1, "total": 5}

event: error
data: {"caseId": "uuid", "error": "string"}
```

---

### `GET /pocs/:id/evals/runs`
List past eval runs.

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "status": "completed",
    "totalCases": 5,
    "passedCases": 4,
    "failedCases": 1,
    "startedAt": "datetime",
    "completedAt": "datetime"
  }
]
```

---

### `GET /pocs/:id/evals/runs/:runId`
Get detailed results for a specific run.

**Response** `200`:
```json
{
  "id": "uuid",
  "status": "completed",
  "results": [
    {
      "caseId": "uuid",
      "caseName": "string",
      "status": "passed",
      "score": 8,
      "reasoning": "string",
      "rawResponse": "string",
      "latencyMs": 1200
    }
  ]
}
```

---

## LLM Connection Endpoints

### `PUT /pocs/:id/llm`
Set or update LLM connection for a POC.

**Request**:
```json
{
  "endpointUrl": "string (URL)",
  "apiKey": "string? (optional)",
  "model": "string"
}
```

**Response** `200`:
```json
{
  "id": "uuid",
  "endpointUrl": "string",
  "model": "string",
  "isActive": true,
  "lastCheckedAt": "datetime"
}
```

---

### `POST /pocs/:id/llm/test`
Test LLM connection health.

**Response** `200`:
```json
{
  "status": "connected",
  "models": ["model-1", "model-2"],
  "latencyMs": 150
}
```

**Response** `422`:
```json
{
  "status": "failed",
  "error": "string (human-readable reason)"
}
```

---

### `GET /pocs/:id/llm/models`
List available models from the connected endpoint.

**Response** `200`:
```json
{
  "models": ["gpt-4", "gpt-3.5-turbo", "llama-3-8b"]
}
```

---

## Error Format

All errors follow:
```json
{
  "statusCode": 400,
  "message": "string (human-readable)",
  "error": "string (HTTP status text)"
}
```
