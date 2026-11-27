import { resolveRawApiConfig } from '../libs/claudeSettings';
import { getPublishedNlqModel, installPublishedNlqModel } from './modelStore';
import { validateNlqModel, validateNlqPhysicalSchema } from './modelValidation';
import { inspectNlqSchema, validateNlqRelationKeys } from './sqlServerRunner';

type ModelAccess = { url: string; apiKey: string; adminUrl: string };
let pending: Promise<void> | null = null;
let lastSchemaSyncAttempt = 0;

export function modelAccessFromApi(baseUrl: string, apiKey: string): ModelAccess {
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || !['/v1', '/v1/', '/v1beta', '/v1beta/'].includes(parsed.pathname)) {
    throw new Error('平台 API 地址应以 /v1 结尾');
  }
  if (!apiKey.trim()) throw new Error('请先在 API 配置中填写平台签发的 Key');
  const origin = parsed.origin;
  return {
    url: `${origin}/jiawork/data-model`,
    adminUrl: parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
      ? `${parsed.protocol}//${parsed.hostname}:3002/?tab=dataModel`
      : `${origin}/?tab=dataModel`,
    apiKey: apiKey.trim(),
  };
}

export function getNlqAdminUrl(): string | null {
  const config = resolveRawApiConfig().config;
  if (!config) return null;
  try { return modelAccessFromApi(config.baseURL, config.apiKey).adminUrl; }
  catch { return null; }
}

async function downloadPublishedModel(): Promise<void> {
  const config = resolveRawApiConfig().config;
  if (!config) throw new Error('请先在 API 配置中连接 JIAWork-Admin');
  const access = modelAccessFromApi(config.baseURL, config.apiKey);
  const response = await fetch(access.url, {
    headers: { Authorization: `Bearer ${access.apiKey}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('平台 API Key 无效或已停用，请检查 API 配置');
    if (response.status === 404) throw new Error('管理平台尚未提供数据模型接口，请更新 JIAWork-Admin');
    throw new Error(`读取管理平台数据模型失败（HTTP ${response.status}）`);
  }
  const body = await response.json() as { model?: unknown };
  const model = validateNlqModel(body.model);
  const changed = JSON.stringify(model) !== JSON.stringify(getPublishedNlqModel());
  const shouldSyncSchema = Date.now() - lastSchemaSyncAttempt > 300_000;
  if (!changed && !shouldSyncSchema) return;
  const schema = await inspectNlqSchema();
  if (shouldSyncSchema) {
    lastSchemaSyncAttempt = Date.now();
    const shareable = schema.filter(table => /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(table.name))
      .map(table => ({ ...table, columns: table.columns.filter(column => /^[A-Za-z_][A-Za-z0-9_]*$/.test(column.name)) }));
    try {
      const upload = await fetch(`${access.url}/schema`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: shareable }),
        signal: AbortSignal.timeout(8000),
      });
      if (!upload.ok) console.warn(`[NLQ] Admin schema sync rejected (HTTP ${upload.status})`);
    } catch (error) {
      console.warn('[NLQ] Admin schema sync failed:', error);
    }
  }
  if (changed) {
    validateNlqPhysicalSchema(model, schema);
    await validateNlqRelationKeys(model);
    installPublishedNlqModel(model);
    console.log(`[NLQ] published model synchronized (version ${model.version})`);
  }
}

/** Refresh before every tool call so Admin publish/revocation takes effect immediately. */
export function refreshPublishedNlqModel(): Promise<void> {
  if (pending) return pending;
  pending = downloadPublishedModel().finally(() => { pending = null; });
  return pending;
}
