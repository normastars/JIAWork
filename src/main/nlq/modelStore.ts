import fs from 'node:fs';
import path from 'node:path';

import type { NlqModel, NlqModelState } from '../../shared/nlq/constants';
import rawModel from './model.json';
import { validateNlqModel } from './modelValidation';

let directory: string | null = null;
let published: NlqModel = validateNlqModel(rawModel);
let draft: NlqModel = structuredClone(published);

function modelPath(kind: 'draft' | 'published'): string {
  if (!directory) throw new Error('查数模型存储尚未初始化');
  return path.join(directory, kind === 'draft' ? 'nlq-model-draft.json' : 'nlq-model.json');
}

function readModel(kind: 'draft' | 'published'): NlqModel | null {
  const file = modelPath(kind);
  if (!fs.existsSync(file)) return null;
  return validateNlqModel(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function atomicWrite(kind: 'draft' | 'published', value: NlqModel): void {
  const file = modelPath(kind);
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function initializeNlqModel(userData: string): void {
  directory = userData;
  try {
    published = readModel('published') ?? validateNlqModel(rawModel);
  } catch (error) {
    console.error('[NLQ] published semantic model load failed:', error);
    published = validateNlqModel(rawModel);
  }
  try {
    draft = readModel('draft') ?? structuredClone(published);
  } catch (error) {
    console.error('[NLQ] draft semantic model load failed:', error);
    draft = structuredClone(published);
  }
  console.log('[NLQ] semantic model loaded');
}

export function getPublishedNlqModel(): NlqModel { return published; }
export function getNlqModelState(): NlqModelState {
  return { published: structuredClone(published), draft: structuredClone(draft) };
}
export function saveNlqDraft(input: unknown): NlqModel {
  const next = validateNlqModel(input);
  atomicWrite('draft', next);
  draft = next;
  return structuredClone(draft);
}
export function publishNlqDraft(): NlqModel {
  const next = { ...draft, version: published.version + 1 };
  atomicWrite('published', next);
  published = next;
  draft = structuredClone(next);
  atomicWrite('draft', draft);
  return structuredClone(published);
}
