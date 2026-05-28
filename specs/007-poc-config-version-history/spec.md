# Feature Specification: POC Config Version History

**Feature Branch**: `007-poc-config-version-history`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "Add POC config version history with diff view and revert. Whenever a user saves changes to the system prompt or tools on a POC, a new config version is automatically created as a snapshot. Users can view the full history of config changes, see a diff between any two versions (system prompt and tools), and restore the POC back to any previous version. Each eval run should record which config version it was run against, and the eval results comparison view should warn the user when the two selected runs used different config versions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Config Snapshots on Save (Priority: P1)

A user edits their POC's system prompt or tools and clicks Save. Without any extra action, the system silently creates a new config version in the background — a timestamped snapshot of the full system prompt and tool definitions at that moment. The user can always see which version they are currently on.

**Why this priority**: This is the foundation all other stories depend on. Without automatic snapshots there is no history to browse, diff, or revert to. It must be transparent and require zero extra effort from the user.

**Independent Test**: Can be fully tested by saving a system prompt change and confirming a new version entry appears in the version history list with the correct timestamp and content, without any additional user action.

**Acceptance Scenarios**:

1. **Given** a POC has a system prompt, **When** the user edits it and saves, **Then** a new config version is created capturing the updated system prompt and current tool definitions.
2. **Given** a POC has tools defined, **When** the user adds, edits, or removes a tool and saves, **Then** a new config version is created capturing the updated tool list and current system prompt.
3. **Given** the user saves without changing either system prompt or tools, **Then** no new config version is created (no duplicate snapshots for identical content).
4. **Given** a POC is first scaffolded, **Then** an initial config version (v1) exists representing the scaffolded state.

---

### User Story 2 - Browse and Diff Config History (Priority: P1)

A user wants to understand how their POC has evolved. They open the config history panel and see a list of all past versions — each showing its version number, timestamp, and a brief summary of what changed (e.g. "System prompt changed", "2 tools modified"). When they select any two versions, they see a diff highlighting exactly what text was added or removed in the system prompt and which tools were added, changed, or deleted.

**Why this priority**: Without visibility into what changed, users cannot make informed decisions about which version to revert to or why a particular eval run performed differently. This is the core UX payoff of the versioning system.

**Independent Test**: Can be fully tested by creating several saves with different content and verifying the version list is correct, selecting two versions produces an accurate diff, and the diff correctly highlights added/removed content in both system prompt and tools.

**Acceptance Scenarios**:

1. **Given** a POC has multiple config versions, **When** the user opens the config history panel, **Then** all versions are listed in reverse-chronological order with version number, timestamp, and change summary.
2. **Given** two versions are selected for comparison, **When** the diff view is shown, **Then** added text in the system prompt is visually distinguished from removed text, and tools that were added, removed, or modified are clearly indicated.
3. **Given** only one version exists, **When** the user opens history, **Then** the version is shown but the diff option is unavailable.
4. **Given** two versions where only tools changed, **When** the diff is shown, **Then** the system prompt section shows "no changes" and only the tools diff is rendered.

---

### User Story 3 - Revert to a Previous Config Version (Priority: P2)

A user reviewed their config history and decided a previous version performed better in evals. They click "Restore" on that version. The POC's system prompt and tools are immediately updated to match that version's snapshot. This restore itself is recorded as a new config version so the history is never destructively modified.

**Why this priority**: Reverting is the primary action the history enables. It is P2 rather than P1 because browsing and diffing (P1) already deliver value independently — users can manually re-apply a previous version's content. The one-click restore is the high-value UX completion.

**Independent Test**: Can be fully tested by restoring a past version and verifying: the POC editor immediately reflects the restored system prompt and tools, a new version entry appears in history labelled as a restore, and the previously current version is still present in history (no data loss).

**Acceptance Scenarios**:

1. **Given** a user selects a past config version and clicks Restore, **When** they confirm, **Then** the POC's system prompt and tools are updated to match that version and a new config version is created recording the restore.
2. **Given** a restore is performed, **When** the user views config history, **Then** both the restored-from version and the new restore-entry are present — no history is deleted.
3. **Given** a user accidentally restores the wrong version, **Then** they can restore again to any other version (the mistaken restore is itself in history and reversible).
4. **Given** a restore completes, **Then** the POC editor immediately shows the restored content without requiring a page refresh.

---

### User Story 4 - Eval Runs Linked to Config Version (Priority: P2)

When a user runs evals, the run is automatically tagged with the config version active at that moment. In the eval results view each run shows which config version it used. When comparing two runs that used different config versions, a clear warning is shown indicating the comparison may not reflect a controlled experiment.

**Why this priority**: This closes the loop between config changes and eval outcomes. Without it a user cannot know whether a score difference was caused by a prompt change or something else. It is P2 because the versioning foundation (P1) must exist first.

**Independent Test**: Can be fully tested by running evals at v1, saving a prompt change (creating v2), running evals again, then comparing — the first run shows v1, the second shows v2, and the comparison view displays a warning.

**Acceptance Scenarios**:

1. **Given** an eval run is started, **Then** it is tagged with the config version active at that moment.
2. **Given** two runs used the same config version, **When** the user compares them, **Then** no config version warning is shown.
3. **Given** two runs used different config versions, **When** the user selects them for comparison, **Then** a visible warning states which versions differ and that conditions were not identical.
4. **Given** the user views a single eval run's details, **Then** the config version number is shown alongside the existing model and endpoint snapshot information.

---

### Edge Cases

- What if a user restores and then immediately makes a manual edit — the history should chain correctly (restore creates v_n, manual edit creates v_n+1).
- What if two saves happen with identical content — only one version should exist (content-based deduplication; no duplicate entries).
- What if there are many config versions — the history list should paginate or show the most recent entries with a "load more" option.
- What if an eval run was created before this feature shipped — it should display as "unknown version" without breaking existing functionality.
- What if the system prompt is very long — the diff must be scrollable and must not truncate content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically create a new config version whenever a user saves a changed system prompt or changed tool definitions on a POC.
- **FR-002**: The system MUST NOT create a new config version when a save occurs but neither the system prompt nor the tool definitions have changed from the latest version.
- **FR-003**: The system MUST create an initial config version (v1) when a POC is first scaffolded.
- **FR-004**: Each config version MUST store: version number, timestamp, full system prompt text, full tool definitions, and an optional label (e.g. "Restored from v3").
- **FR-005**: Users MUST be able to view the complete list of config versions for a POC in reverse-chronological order.
- **FR-006**: Each version list entry MUST display a human-readable change summary indicating whether the system prompt changed, tools changed, or both.
- **FR-007**: Users MUST be able to select any two config versions and view a diff highlighting added and removed content in the system prompt and changes to tool definitions.
- **FR-008**: Users MUST be able to restore any past config version, which replaces the current system prompt and tools with the selected version's content.
- **FR-009**: A restore action MUST create a new config version entry recording that a restore occurred and which version was the source.
- **FR-010**: Every eval run MUST be tagged with the config version that was active when the run was initiated.
- **FR-011**: The eval results comparison view MUST display a warning when the two selected runs reference different config versions.
- **FR-012**: Config version numbers MUST be monotonically increasing integers scoped per POC, starting at 1.

### Key Entities

- **Config Version**: A point-in-time snapshot of a POC's system prompt and tool definitions. Has a version number, timestamp, change summary, optional restore label, and the full content of both fields.
- **POC** (existing): The central config entity. Gains a reference to its current config version.
- **Eval Run** (existing): Gains a reference to the config version that was active when the run was started.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every save of a changed system prompt or tools produces exactly one new config version — no missed snapshots and no duplicate entries for identical content.
- **SC-002**: A user can find and view a diff between any two config versions in 3 clicks or fewer from the POC editor.
- **SC-003**: A restore operation completes and the POC editor reflects the restored content without a page refresh.
- **SC-004**: 100% of eval runs initiated after this feature ships are tagged with a config version.
- **SC-005**: The config version mismatch warning appears on every comparison of runs from different config versions, with zero false positives (same-version comparisons show no warning).

## Assumptions

- The initial POC scaffolding counts as the first config-changing event and creates v1 automatically.
- Config version history is append-only — versions are never deleted; only new entries are added (including restore entries).
- The diff view compares system prompt as plain text and tools as a structured list (name, description, parameters per tool).
- Versions with identical system prompt AND identical tool definitions are considered duplicates and will not be created (content-based deduplication).
- The history panel is accessible from within the POC editor, not as a separate page.
- Eval runs created before this feature shipped will display as "unknown version" without breaking existing functionality.
- This feature does not version eval cases — that is already handled by the existing EvalSuiteVersion system.
- The feature is scoped to the POC editor; no changes are needed to the home page or scaffolding flow.
