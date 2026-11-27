import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { getNlqModelState, initializeNlqModel, installPublishedNlqModel } from './modelStore';

let directory: string;
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawork-nlq-model-')); });
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe('NLQ published model cache', () => {
  test('persists the Admin model and reloads it on startup', () => {
    initializeNlqModel(directory);
    const initial = getNlqModelState().published;
    const remote = installPublishedNlqModel({ ...initial, version: 2, name: '新业务模型' });
    expect(remote.name).toBe('新业务模型');
    expect(fs.statSync(path.join(directory, 'nlq-model.json')).mode & 0o777).toBe(0o600);
    initializeNlqModel(directory);
    expect(getNlqModelState().published).toEqual(remote);
  });

  test('preserves the previous local model when Admin replaces it', () => {
    initializeNlqModel(directory);
    const initial = getNlqModelState().published;
    const local = installPublishedNlqModel({ ...initial, version: 2, name: '原本地模型' });
    installPublishedNlqModel({ ...local, version: 3, name: 'Admin 模型' });
    expect(JSON.parse(fs.readFileSync(path.join(directory, 'nlq-model.pre-admin.json'), 'utf8'))).toEqual(local);
    expect(getNlqModelState().published.name).toBe('Admin 模型');
  });
});
