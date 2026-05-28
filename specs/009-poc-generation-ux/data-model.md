# Data Model: PoC Generation UX

**Feature**: 009-poc-generation-ux  
**Date**: 2026-05-28

---

## Prisma Schema Changes

**None.** No new tables, no new columns. All scaffold output is persisted into the existing `PocConfig` and `EvalCase` tables, identical to the current implementation.

---

## In-Memory Job Registry

The scaffold job state is managed entirely in memory inside `ScaffoldService`. It is **not persisted** and **not part of the Prisma schema**.

```typescript
// In ScaffoldService
private jobs = new Map<string, Subject<MessageEvent>>();
```

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `string` (UUID v4) | Key generated at POST time |
| `subject` | `Subject<MessageEvent>` | RxJS Subject; completes on done/error |

**Lifecycle**: Created when `POST /api/pocs/scaffold` is received. Removed from Map when the Subject completes (after `done` or `error` event is emitted).

**No cleanup timer needed** for the single-user local-tool use case. If the browser disconnects mid-stream, the Subject has no subscribers and the async scaffold job runs to completion harmlessly (it will emit to a Subject with no subscribers, then complete and clean up the Map entry).

---

## New Shared Types (packages/shared/src/types.ts)

These are TypeScript-only additions — no DB impact.

```typescript
export type ScaffoldStep = 'analysing' | 'system-prompt' | 'tools' | 'eval-cases' | 'saving';

export interface ScaffoldStepStartEvent {
  type: 'step-start';
  step: ScaffoldStep;
  index: number;
  total: number;
}

export interface ScaffoldStepCompleteEvent {
  type: 'step-complete';
  step: ScaffoldStep;
  content?: ScaffoldContentPayload;
}

export interface ScaffoldContentPayload {
  type: 'system-prompt' | 'tools' | 'eval-cases';
  name?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  evalCases?: Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }>;
}

export interface ScaffoldDoneEvent {
  type: 'done';
  pocId: string;
}

export interface ScaffoldErrorEvent {
  type: 'error';
  step: ScaffoldStep;
  message: string;
}

export type ScaffoldStreamEvent =
  | ScaffoldStepStartEvent
  | ScaffoldStepCompleteEvent
  | ScaffoldDoneEvent
  | ScaffoldErrorEvent;

export interface ScaffoldJobResponse {
  jobId: string;
}
```

---

## Frontend State Shape

The `ScaffoldProgress` component manages this state locally (no React Query, no global store):

```typescript
type StepState = 'waiting' | 'in-progress' | 'complete' | 'error';

interface StepStatus {
  id: ScaffoldStep;
  label: string;
  state: StepState;
}

interface ScaffoldProgressState {
  steps: StepStatus[];
  previewName: string | null;
  previewSystemPrompt: string | null;
  previewTools: ToolDefinition[] | null;
  previewEvalCases: Array<{ name: string; judgeCriteria: string }> | null;
  errorMessage: string | null;
  errorStep: ScaffoldStep | null;
}
```
