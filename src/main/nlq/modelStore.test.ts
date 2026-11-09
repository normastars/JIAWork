import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { getNlqModelState, initializeNlqModel, publishNlqDraft, saveNlqDraft } from './modelStore';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawork-nlq-model-'));

afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

describe('NLQ model publishing', () => {
  test('keeps draft separate until publish and reloads the published version', () => {
    initializeNlqModel(directory);
    const initial = getNlqModelState();
    saveNlqDraft({ ...initial.draft, name: '新业务模型' });
    expect(getNlqModelState().published.name).toBe(initial.published.name);
    expect(getNlqModelState().draft.name).toBe('新业务模型');
    const published = publishNlqDraft();
    expect(published.version).toBe(initial.published.version + 1);
    expect(published.name).toBe('新业务模型');
    expect(fs.statSync(path.join(directory, 'nlq-model.json')).mode & 0o777).toBe(0o600);
    initializeNlqModel(directory);
    expect(getNlqModelState().published).toEqual(published);
  });
});
