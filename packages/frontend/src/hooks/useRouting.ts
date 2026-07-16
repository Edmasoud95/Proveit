import { useQuery } from '@tanstack/react-query';
import type { LlmProvider, LlmRoutingConfig, TaskType } from '@proveit/shared';
import { api } from '../services/api';

/** Routing config for a POC: its own providers + global providers + task overrides. */
export function useRouting(pocId: string | undefined) {
  return useQuery({
    queryKey: ['routing', pocId],
    queryFn: () => api.get<LlmRoutingConfig>(`/pocs/${pocId}/llm/routing`),
    enabled: !!pocId,
  });
}

export interface EffectiveProvider {
  provider: LlmProvider;
  model: string;
  source: 'override' | 'poc-default' | 'global-default';
}

/**
 * Mirrors the backend's LlmService.resolveForTask chain:
 * task override → POC default provider → global default provider.
 * Returns null only when no provider would resolve on the backend either.
 */
export function resolveEffectiveProvider(
  routing: LlmRoutingConfig | undefined,
  taskType: TaskType,
): EffectiveProvider | null {
  if (!routing) return null;
  const override = routing.overrides.find((o) => o.taskType === taskType);
  if (override) {
    const provider = routing.providers.find((p) => p.id === override.connectionId);
    if (provider) return { provider, model: override.model, source: 'override' };
  }
  const pocDefault = routing.providers.find((p) => !p.isGlobal && p.isDefault);
  if (pocDefault) return { provider: pocDefault, model: pocDefault.model, source: 'poc-default' };
  const globalDefault = routing.providers.find((p) => p.isGlobal && p.isDefault);
  if (globalDefault) {
    return { provider: globalDefault, model: globalDefault.model, source: 'global-default' };
  }
  return null;
}
