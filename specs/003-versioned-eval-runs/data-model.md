# Data Model: Versioned Eval Runs with Failure Traces

## Schema Changes

### New Model: `EvalSuiteVersion`

```prisma
model EvalSuiteVersion {
  id            String    @id @default(uuid())
  pocConfigId   String
  versionNumber Int
  casesSnapshot String    // JSON: serialized EvalCase[] (id, name, input, judgeCriteria, order)
  createdAt     DateTime  @default(now())

  pocConfig PocConfig @relation(fields: [pocConfigId], references: [id], onDelete: Cascade)
  runs      EvalRun[]
}
```

**Notes**:
- `(pocConfigId, versionNumber)` is effectively unique — enforced at application level on creation.
- `casesSnapshot` stores the full eval case array as a JSON string at the moment the version is created. This snapshot is immutable after creation.
- A new version row is created after every `createEvalCase`, `updateEvalCase`, or `deleteEvalCase` operation for the POC. If no eval cases exist (e.g. all deleted), the snapshot is an empty array `[]`.
- `PocConfig` needs a new `evalSuiteVersions EvalSuiteVersion[]` relation field.

---

### Extended Model: `EvalRun`

New columns (all backward-compatible defaults):

```prisma
model EvalRun {
  // --- existing fields (unchanged) ---
  id                String    @id @default(uuid())
  pocConfigId       String
  status            String    // 'pending' | 'running' | 'completed' | 'failed'
  totalCases        Int
  passedCases       Int
  failedCases       Int
  startedAt         DateTime  @default(now())
  completedAt       DateTime?

  // --- new fields ---
  runNumber             Int       @default(0)    // sequential per POC; display as "Run #N"
  evalSuiteVersionId    String?                  // nullable: existing runs have no version
  snapshotSystemPrompt  String    @default("")   // system prompt text at run start
  snapshotModel         String    @default("")   // model identifier at run start
  snapshotEndpointUrl   String    @default("")   // endpoint URL at run start (no API key)

  // --- relations ---
  pocConfig        PocConfig         @relation(fields: [pocConfigId], references: [id], onDelete: Cascade)
  evalSuiteVersion EvalSuiteVersion? @relation(fields: [evalSuiteVersionId], references: [id], onDelete: SetNull)
  results          EvalResult[]
}
```

**Notes**:
- `runNumber` is assigned at run creation as `(max existing runNumber for this pocConfigId) + 1`.
- `evalSuiteVersionId` is nullable so existing runs continue to work. Runs with `null` version are displayed as "v?" in the UI.
- Snapshot fields default to `""` — existing migration rows get empty strings, displayed as "unknown" in the UI.
- `onDelete: SetNull` on the version FK means deleting a version does not cascade-delete its runs.

---

### Extended Model: `EvalResult`

New columns (all nullable):

```prisma
model EvalResult {
  // --- existing fields (unchanged) ---
  id          String    @id @default(uuid())
  evalCaseId  String
  runId       String
  status      String    // 'pending' | 'running' | 'passed' | 'failed' | 'errored'
  score       Int?
  reasoning   String?
  rawResponse String?
  latencyMs   Int?
  createdAt   DateTime  @default(now())

  // --- new fields ---
  pipelineTrace String?   // JSON: OpenAI messages array (full agent conversation history)
  errorDetail   String?   // error.message for 'errored' cases (was previously lost)
  failureStep   String?   // 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null

  // --- relations (unchanged) ---
  evalCase EvalCase @relation(fields: [evalCaseId], references: [id], onDelete: Cascade)
  evalRun  EvalRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
}
```

**Notes**:
- `pipelineTrace` is the raw OpenAI `messages` array serialized to JSON. Structure: `[{role, content}, {role: 'assistant', tool_calls: [{id, type, function: {name, arguments}}]}, {role: 'tool', tool_call_id, content: mock_response}, ...]`. Null for cases that errored before any messages were sent.
- `errorDetail` fills the existing gap where errored cases had no diagnostic info stored.
- `failureStep` is `null` for passing cases and for cases where the judge cannot determine a specific step.
- All three columns are nullable so existing `EvalResult` rows are unaffected.

---

## Entity Relationships

```
PocConfig (1)
  ├── EvalCase[]         (1:many, existing)
  ├── EvalSuiteVersion[] (1:many, new)   ← created on any EvalCase CRUD
  │     └── EvalRun[]    (1:many, via evalSuiteVersionId FK)
  └── EvalRun[]          (1:many, existing direct FK)

EvalRun (1)
  ├── EvalSuiteVersion   (many:1, optional FK, new)
  └── EvalResult[]       (1:many, existing)

EvalResult (1)
  └── EvalCase           (many:1, existing)
```

---

## State Transitions

**EvalSuiteVersion** is created once and never mutated. It is a point-in-time snapshot.

**EvalRun.status** (unchanged):
```
pending → running → completed
                 └→ failed
```

**EvalResult.status** (unchanged):
```
pending → running → passed
                 └→ failed
                 └→ errored
```

---

## PipelineTrace Shape (TypeScript)

For frontend rendering, the backend parses `pipelineTrace` JSON into:

```ts
type PipelineStep =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCallStep[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

type ToolCallStep = {
  id: string;
  name: string;
  arguments: string; // JSON string of the arguments object
};
```

The `EvalRunDetail` response maps the raw OpenAI message format to `PipelineStep[]` before sending to the frontend, resolving tool names from `tool_call_id` references.

---

## Migration Notes

- All new columns use `@default("")`, `@default(0)`, or are nullable — the SQLite migration adds columns without touching existing rows.
- Run `pnpm --filter backend db:migrate` after merging schema changes.
- Existing `EvalRun` rows will have `runNumber: 0`, `evalSuiteVersionId: null`, and empty snapshot strings. The UI treats `runNumber: 0` as "legacy run" and `evalSuiteVersionId: null` as "v?" version.
- No data backfill is required for existing runs.
