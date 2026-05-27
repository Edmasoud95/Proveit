# Quickstart: Multi-Provider LLM with Per-Task Model Routing

**Feature**: 004-multi-provider-llm  
**Date**: 2026-05-27

---

## Scenario 1: Single Provider (Zero-Config Compatibility)

**Goal**: Verify that an existing POC with one LLM connection continues to work without any changes.

**Steps**:
1. Open a POC that was configured before this feature.
2. Navigate to LLM Settings.
3. Observe: the existing connection appears as a provider named "Default" with a default star/badge.
4. The "Advanced model routing" panel is collapsed and shows "Default" for all task types.
5. Run evals — they execute normally against the single provider.

**Expected state after migration**:
```
GET /api/pocs/:id/llm/providers
→ [{ name: "Default", isDefault: true, endpointUrl: "...", model: "..." }]

GET /api/pocs/:id/llm/routing
→ { providers: [...], overrides: [] }
```

---

## Scenario 2: Adding a Second Provider

**Goal**: Configure two providers on one POC and run evals against the default.

**Steps**:
1. Open LLM Settings.
2. Click "Add provider".
3. Fill in: Name = "OpenAI", Endpoint = `https://api.openai.com/v1`, API Key = `sk-...`, Model = `gpt-4o`.
4. Click "Test connection" — models list appears.
5. Click "Save".
6. The provider list now shows two entries: "Default" (LM Studio) with a star, and "OpenAI" without.
7. Run evals — they use "Default" (LM Studio) since no routing overrides are set.

**API flow**:
```
POST /api/pocs/:id/llm/providers
{ name: "OpenAI", endpointUrl: "https://api.openai.com/v1", apiKey: "sk-...", model: "gpt-4o" }
→ 201 { id: "new-uuid", name: "OpenAI", isDefault: false, ... }

POST /api/pocs/:id/llm/providers/new-uuid/test
→ { status: "connected", models: ["gpt-4o", "gpt-4o-mini"], latencyMs: 380 }
```

---

## Scenario 3: Per-Task Routing Override

**Goal**: Route the judge task to GPT-4o while keeping eval generation on the local model.

**Prerequisites**: Two providers configured (Scenario 2 complete).

**Steps**:
1. Open LLM Settings.
2. Click "Advanced model routing" — the panel expands showing four rows: Agent, Judge, Eval Generation, Stub Generation. All show "Default".
3. In the "Judge" row, select "OpenAI" from the provider dropdown, then "gpt-4o" from the model dropdown.
4. The row now shows "OpenAI / gpt-4o".
5. Run evals.
6. Backend uses LM Studio for Agent and Eval Generation; GPT-4o for Judge.

**API flow**:
```
PUT /api/pocs/:id/llm/routing/judge
{ connectionId: "openai-uuid", model: "gpt-4o" }
→ 200 { taskType: "judge", connectionId: "openai-uuid", providerName: "OpenAI", model: "gpt-4o" }
```

**Verification** (backend logs / run summary):
- `snapshotModel` for the eval run reflects the agent provider's model.
- Judge calls use the overridden provider client.

---

## Scenario 4: Deleting a Provider with Active Overrides

**Goal**: Verify that deleting a non-default provider with task overrides silently reverts those tasks to default.

**Prerequisites**: "Judge" override set to "OpenAI" (Scenario 3 complete).

**Steps**:
1. In the provider list, click Delete on "OpenAI".
2. Confirmation dialog appears: "Delete OpenAI? Any task routing overrides using this provider will revert to the default."
3. Confirm deletion.
4. Provider list shows only "Default".
5. Open "Advanced model routing" — "Judge" row now shows "Default".

**API flow**:
```
DELETE /api/pocs/:id/llm/providers/openai-uuid
→ 204  (TaskModelOverride for judge auto-deleted via DB cascade)
```

---

## Scenario 5: Changing the Default Provider

**Goal**: Make "OpenAI" the default provider so all unoveridden tasks route there.

**Prerequisites**: Two providers configured.

**Steps**:
1. In the provider list, click the star/crown icon on "OpenAI".
2. "OpenAI" gets the default badge; "LM Studio" loses it.
3. Run evals — all tasks (without overrides) now use OpenAI.

**API flow**:
```
POST /api/pocs/:id/llm/providers/openai-uuid/default
→ 200 { id: "openai-uuid", isDefault: true, ... }
```

---

## Scenario 6: Cannot Delete Default When Others Exist

**Goal**: Verify the guard that prevents orphaning a POC without a default provider.

**Steps**:
1. Two providers configured; "LM Studio" is default.
2. Click Delete on "LM Studio".
3. Error: "Designate another provider as default before deleting this one."
4. User sets "OpenAI" as default first, then retries — deletion succeeds.

**API response**:
```
DELETE /api/pocs/:id/llm/providers/lmstudio-uuid
→ 400 { error: "CANNOT_DELETE_DEFAULT", message: "..." }
```

---

## Scenario 7: Provider Unreachable During Eval Run

**Goal**: Verify error isolation — one failing provider doesn't crash the entire run.

**Steps**:
1. "Judge" is overridden to "OpenAI" but OpenAI is unreachable (network off).
2. Run evals.
3. Each case's judge step fails with: `"Judge task failed: Provider 'OpenAI' — Connection refused"`.
4. The eval case status is `errored`; the agent step (using LM Studio) completed normally.
5. Other cases in the run that don't hit the unreachable provider continue normally.

---

## Integration Test Checklist

| Test | Expected |
|------|----------|
| Existing POC after migration | Single provider named "Default", `isDefault=true` |
| Add provider → first one | Auto-set as default |
| Add provider → subsequent ones | `isDefault=false` |
| Test provider → success | `availableModels` populated, `isActive=true` |
| Test provider → failure | `isActive=false`, error message returned |
| Set routing override | Override stored, `GET /routing` includes it |
| Clear routing override | Override deleted, task uses default |
| Delete non-default provider with overrides | Provider deleted, overrides auto-cleared |
| Delete default with other providers | 400 `CANNOT_DELETE_DEFAULT` |
| Delete only provider | 204, POC now has no providers |
| `resolveForTask` with override | Returns override's client + model |
| `resolveForTask` without override | Returns default provider's client + model |
| `resolveForTask` with no providers | 404 `NO_DEFAULT_PROVIDER` |
