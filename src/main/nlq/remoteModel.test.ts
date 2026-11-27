import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import rawModel from './model.json';
import { getPublishedNlqModel, initializeNlqModel } from './modelStore';

vi.mock('../libs/claudeSettings', () => ({
  resolveRawApiConfig: () => ({ config: { baseURL: 'http://127.0.0.1:3000/v1', apiKey: 'sk-example' } }),
}));

vi.mock('./sqlServerRunner', async () => {
  const { default: model } = await import('./model.json');
  const schema = Object.entries(model.tables).map(([id, table]) => {
    const types = new Map<string, string>();
    if ('dateColumn' in table) types.set(table.dateColumn, 'datetime2');
    for (const column of Object.values(table.dimensions)) types.set(column, 'nvarchar');
    for (const metric of Object.values(model.metrics).filter(item => item.table === id)) {
      types.set(metric.column, 'decimal');
      if ('subtractColumn' in metric) types.set(metric.subtractColumn, 'decimal');
    }
    for (const relation of Object.values(model.relations)) {
      if (relation.fromTable === id) types.set(relation.fromColumn, 'nvarchar');
      if (relation.toTable === id) types.set(relation.toColumn, 'nvarchar');
    }
    return { name: table.name, columns: [...types].map(([name, dataType]) => ({ name, dataType })) };
  });
  return { inspectNlqSchema: async () => schema, validateNlqRelationKeys: async () => {} };
});

import { modelAccessFromApi, refreshPublishedNlqModel } from './remoteModel';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawork-admin-model-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
afterEach(() => vi.unstubAllGlobals());

describe('Admin data model endpoint', () => {
  test('uses the existing platform API origin and key', () => {
    expect(modelAccessFromApi('http://127.0.0.1:3000/v1', 'sk-example')).toEqual({
      url: 'http://127.0.0.1:3000/jiawork/data-model',
      adminUrl: 'http://127.0.0.1:3002/?tab=dataModel',
      apiKey: 'sk-example',
    });
    expect(modelAccessFromApi('https://admin.example.com/v1', 'sk-example').adminUrl)
      .toBe('https://admin.example.com/?tab=dataModel');
  });

  test('rejects a missing platform key or unsupported API address', () => {
    expect(() => modelAccessFromApi('https://admin.example.com/v1', '')).toThrow();
    expect(() => modelAccessFromApi('https://api.openai.com/v1/chat/completions', 'sk-example')).toThrow();
  });

  test('downloads and installs the published model with the platform key', async () => {
    initializeNlqModel(directory);
    const model = { ...rawModel, version: 2, name: 'Admin 已发布模型' };
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return { ok: true, status: 200 };
      return { ok: true, status: 200, json: async () => ({ model }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    await refreshPublishedNlqModel();
    expect(getPublishedNlqModel().name).toBe('Admin 已发布模型');
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'nlq-model.json'), 'utf8')).version).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/jiawork/data-model',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-example' }) }));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3000/jiawork/data-model/schema',
      expect.objectContaining({ method: 'POST' }));
  });

  test('rejects a disabled key even when a local copy exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    await expect(refreshPublishedNlqModel()).rejects.toThrow('平台 API Key 无效或已停用');
  });
});
