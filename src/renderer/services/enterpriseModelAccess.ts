import { type ProviderConfig,ProviderName } from '../../shared/providers';
import type { AppConfig } from '../config';
import { i18nService } from './i18n';

type ProviderModel = NonNullable<ProviderConfig['models']>[number];

export async function fetchAllowedModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.trim().replace(/\/+$/, '')}/models`;
  const response = await window.electron.api.fetch({
    url,
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });
  if (!response.ok) {
    throw new Error(`${i18nService.t('settingsAllowedModelsRequestFailed')} (HTTP ${response.status})`);
  }
  const data = response.data as { data?: Array<{ id?: unknown }> };
  const ids = Array.isArray(data?.data)
    ? [...new Set(data.data.map(item => item.id).filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  if (ids.length === 0) {
    throw new Error(i18nService.t('settingsNoAllowedModels'));
  }
  return ids;
}

export function resolveAllowedModels(
  allowedIds: string[],
  knownModels: ProviderModel[],
  preferredId: string,
): { models: ProviderModel[]; defaultModel: string } {
  const knownById = new Map(knownModels.map(model => [model.id, model]));
  const models = allowedIds.map(id => knownById.get(id) ?? {
    id,
    name: id,
    contextWindow: 128_000,
    maxTokens: 8_192,
  });
  return {
    models,
    defaultModel: allowedIds.includes(preferredId) ? preferredId : allowedIds[0],
  };
}

export async function syncEnterpriseAgentModels(allowedIds: string[], defaultModel: string): Promise<void> {
  const agents = await window.electron.agents.list();
  for (const agent of agents) {
    const current = agent.model.trim();
    const [provider, modelId] = current.includes('/') ? current.split('/', 2) : [ProviderName.OpenAI, current];
    if (provider !== ProviderName.OpenAI || allowedIds.includes(modelId)) continue;
    const updated = await window.electron.agents.update(agent.id, {
      model: `${ProviderName.OpenAI}/${defaultModel}`,
    });
    if (!updated) throw new Error(i18nService.t('settingsAgentModelUpdateFailed'));
  }
}

export async function reconcileEnterpriseModels(config: AppConfig): Promise<AppConfig> {
  const provider = config.providers?.[ProviderName.OpenAI];
  if (!provider?.enabled || !provider.apiKey.trim() || !provider.baseUrl.trim()) return config;
  const allowedIds = await fetchAllowedModels(provider.baseUrl, provider.apiKey);
  const resolved = resolveAllowedModels(allowedIds, provider.models ?? [], config.model.defaultModel);
  const nextConfig: AppConfig = {
    ...config,
    providers: {
      ...config.providers,
      [ProviderName.OpenAI]: { ...provider, models: resolved.models },
    },
    model: {
      ...config.model,
      defaultModel: resolved.defaultModel,
      defaultModelProvider: ProviderName.OpenAI,
    },
  };
  await syncEnterpriseAgentModels(allowedIds, resolved.defaultModel);
  return nextConfig;
}
