# Research: POC Config Version History

## Insertion Points (from codebase exploration)

### Where to create a config version snapshot

| Trigger | File | Method | After line | Scope available |
|---------|------|--------|------------|-----------------|
| POC creation (v1) | `scaffold/scaffold.service.ts` | `scaffold()` | after `prisma.pocConfig.create` (~line 80) | `poc.id`, `poc.systemPrompt`, `poc.tools` |
| System prompt or tools save | `poc/poc.service.ts` | `update()` | after `prisma.pocConfig.update` (~line 78) | `id`, updated record, `dto.systemPrompt`, `dto.tools` |
| Eval run start (stamp only) | `eval/eval.service.ts` | `startRun()` | after `prisma.evalRun.create` (~line 185) | `poc.id`, current `PocConfigVersion` lookup |

### Deduplication strategy

**Decision**: Compare content hash (SHA of `systemPrompt + tools`) against the most recent version before inserting.
**Rationale**: Spec FR-002 requires no duplicate snapshots for identical saves. A single `findFirst({ orderBy: { versionNumber: 'desc' } })` before insert is sufficient; hash comparison is O(n) on string length but negligible at this scale.
**Alternatives considered**: Always insert and deduplicate on read — rejected, messier queries and bloats the table.

### Diff algorithm (no new packages)

**Decision**: Hand-rolled line-by-line LCS diff for system prompt; structural diff for tools by tool name.
**Rationale**: Constitution principle V (no new packages). The system prompt is plain text — a basic Myers diff produces correct +/- line output. Tools are a JSON array that can be diffed by matching on `name` field: added (in new, not in old), removed (in old, not in new), modified (same name, different description/parameters).
**Alternatives considered**: `diff` npm package — rejected (new dependency). `jsdiff` — rejected (same). Server-side diff endpoint — rejected (unnecessary round-trip; all data is already in the frontend after fetching two versions).

### Where diff runs

**Decision**: Client-side, computed on demand when the user selects two versions.
**Rationale**: Both version snapshots are fetched as part of the version list (or fetched individually). Computing diff in the browser is instant. No extra endpoint needed.

### Restore mechanism

**Decision**: Restore calls `PATCH /api/pocs/:id` with `{ systemPrompt, tools }` from the chosen version — the same update path that already triggers a new snapshot. A `restoreLabel` field on the snapshot records which version was restored from.
**Rationale**: Reuses the existing update path entirely. The snapshot hook in `update()` fires automatically, creating a new version entry with a `restoreLabel` like "Restored from v3". No separate restore service method needed beyond reading the version and calling update.
**Alternatives considered**: A dedicated `POST /pocs/:id/config-versions/:versionId/restore` endpoint — acceptable but adds a method that just reads + re-writes. The PATCH approach is simpler and keeps the snapshot logic in one place.

### EvalRun config version stamping

**Decision**: At eval run start (`startRun()`), look up the latest `PocConfigVersion` for the POC and write its ID to `EvalRun.configVersionId`. Also write `configVersionNumber` as a denormalized snapshot so it remains readable even if versions are ever purged in future.
**Rationale**: Spec FR-010 requires every run to be stamped. Storing the ID enables JOIN queries; the denormalized number enables display without a join.
**Alternatives considered**: Look up version on read — rejected, fragile if history is ever cleared.

### Change summary label generation

**Decision**: Generate the change summary server-side at snapshot creation time by comparing the new snapshot against the previous version: if `systemPrompt` differs set "System prompt changed"; if `tools` JSON differs set "Tools changed"; if both differ set "System prompt and tools changed"; if first version set "Initial version".
**Rationale**: Storing the label on write is cheaper than recomputing on every read. The label is stored as a plain string in `changeLabel` on `PocConfigVersion`.

### History panel UI placement

**Decision**: A collapsible "Version history" section at the bottom of the POC editor, outside the tab system (visible regardless of whether the user is on the prompt or tools tab). Shows current version badge inline in each tab's header.
**Rationale**: History is cross-cutting (covers both prompt and tools); putting it inside one tab would be misleading. Collapsible satisfies Progressive Disclosure (principle VII).
