# Data Model: Project Scaffolding

**Feature**: 001-project-scaffolding
**Date**: 2026-05-26

## Entities

### PocConfig

The central data model. Everything reads from and writes to it.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | User-given name for the POC |
| description | String | Original workflow description |
| systemPrompt | Text | The generated/edited system prompt |
| tools | JSON | Array of tool definitions (name, description, parameters schema) |
| metadata | JSON | Timestamps, version, tags |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last modification timestamp |

**Relationships**: Has many EvalCase, has one LlmConnection

---

### EvalCase

A single test scenario belonging to a POC.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| pocConfigId | UUID | FK → PocConfig |
| name | String | Short descriptive name |
| input | JSON | The input context/messages for this test case |
| judgeCriteria | Text | What the judge LLM should evaluate (rubric) |
| order | Integer | Display/execution order |
| createdAt | DateTime | Creation timestamp |

**Relationships**: Belongs to PocConfig, has many EvalResult

---

### EvalResult

The outcome of running one eval case.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| evalCaseId | UUID | FK → EvalCase |
| runId | String | Groups results from the same eval run |
| status | Enum | pending, running, passed, failed, errored |
| score | Integer | 0-10 judge score |
| reasoning | Text | Judge's explanation for the score |
| rawResponse | Text | The LLM's full response to the eval case |
| latencyMs | Integer | Time taken for the LLM response |
| createdAt | DateTime | Execution timestamp |

**Relationships**: Belongs to EvalCase

---

### LlmConnection

Endpoint configuration for a POC's connected LLM.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| pocConfigId | UUID | FK → PocConfig (unique) |
| endpointUrl | String | Base URL of the OpenAI-compatible endpoint |
| apiKey | String (encrypted) | Optional API key for external providers |
| model | String | Selected model name (e.g., "gpt-4", "llama-3") |
| isActive | Boolean | Whether connection is currently valid |
| lastCheckedAt | DateTime | Last health check timestamp |

**Relationships**: Belongs to PocConfig (one-to-one)

---

### EvalRun

Groups eval results from a single execution.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key (same as runId in EvalResult) |
| pocConfigId | UUID | FK → PocConfig |
| status | Enum | pending, running, completed, failed |
| totalCases | Integer | Number of cases in this run |
| passedCases | Integer | Number passed |
| failedCases | Integer | Number failed |
| startedAt | DateTime | Run start time |
| completedAt | DateTime | Run completion time (nullable) |

**Relationships**: Belongs to PocConfig, has many EvalResult (via runId)

## State Transitions

### EvalResult.status

```
pending → running → passed
                  → failed
                  → errored
```

### EvalRun.status

```
pending → running → completed
                  → failed
```

## Validation Rules

- PocConfig.systemPrompt: Required, non-empty
- PocConfig.tools: Valid JSON array, each tool must have `name` and `description`
- EvalCase.input: Valid JSON, must contain at least one message
- EvalCase.judgeCriteria: Required, non-empty
- LlmConnection.endpointUrl: Must be a valid URL
- LlmConnection.model: Required when isActive is true
- EvalResult.score: 0-10 inclusive
