import { describe, expect, it } from 'vitest';
import type { LlmProvider, LlmRoutingConfig } from '@proveit/shared';
import { resolveEffectiveProvider } from './useRouting';

const provider = (over: Partial<LlmProvider>): LlmProvider => ({
  id: 'p1',
  name: 'Provider',
  isDefault: false,
  endpointUrl: 'http://localhost:1234/v1',
  model: 'base-model',
  isActive: true,
  ...over,
});

const pocDefault = provider({ id: 'poc-1', name: 'POC LM Studio', isDefault: true });
const globalDefault = provider({
  id: 'glob-1',
  name: 'Global OpenAI',
  isDefault: true,
  isGlobal: true,
  model: 'gpt-4o-mini',
});

function routing(providers: LlmProvider[], overrides: LlmRoutingConfig['overrides'] = []): LlmRoutingConfig {
  return { providers, overrides };
}

describe('resolveEffectiveProvider', () => {
  it('returns null without routing data or providers', () => {
    expect(resolveEffectiveProvider(undefined, 'agent')).toBeNull();
    expect(resolveEffectiveProvider(routing([]), 'agent')).toBeNull();
  });

  it('prefers a task override, including overrides on global providers', () => {
    const cfg = routing(
      [pocDefault, globalDefault],
      [{ taskType: 'agent', connectionId: 'glob-1', providerName: 'Global OpenAI', model: 'gpt-4o' }],
    );
    expect(resolveEffectiveProvider(cfg, 'agent')).toEqual({
      provider: globalDefault,
      model: 'gpt-4o',
      source: 'override',
    });
    // other tasks are unaffected by the agent override
    expect(resolveEffectiveProvider(cfg, 'judge')?.source).toBe('poc-default');
  });

  it('falls back to the POC default before the global default', () => {
    const resolved = resolveEffectiveProvider(routing([pocDefault, globalDefault]), 'agent');
    expect(resolved).toEqual({ provider: pocDefault, model: 'base-model', source: 'poc-default' });
  });

  it('falls back to the global default when the POC has no providers', () => {
    const resolved = resolveEffectiveProvider(routing([globalDefault]), 'agent');
    expect(resolved).toEqual({ provider: globalDefault, model: 'gpt-4o-mini', source: 'global-default' });
  });

  it('returns null when providers exist but none is a default', () => {
    const cfg = routing([provider({ id: 'x', isDefault: false })]);
    expect(resolveEffectiveProvider(cfg, 'agent')).toBeNull();
  });
});
