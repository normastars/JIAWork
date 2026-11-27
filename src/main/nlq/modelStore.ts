import fs from 'node:fs';
import path from 'node:path';

import type { NlqModel, NlqModelState } from '../../shared/nlq/constants';
import rawModel from './model.json';
import { validateNlqModel } from './modelValidation';

let directory: string | null = null;
let published: NlqModel = validateNlqModel(rawModel);

function modelPath(): string {
  if (!directory) throw new Error('查数模型存储尚未初始化');
  return path.join(directory, 'nlq-model.json');
}

function readModel(): NlqModel | null {
  const file = modelPath();
  if (!fs.existsSync(file)) return null;
  return validateNlqModel(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function atomicWrite(value: NlqModel): void {
  const file = modelPath();
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function initializeNlqModel(userData: string): void {
  directory = userData;
  try {
    published = readModel() ?? validateNlqModel(rawModel);
  } catch (error) {
    console.error('[NLQ] published semantic model load failed:', error);
    published = validateNlqModel(rawModel);
  }
  console.log('[NLQ] semantic model loaded');
}

export function getPublishedNlqModel(): NlqModel { return published; }
export function installPublishedNlqModel(input: unknown): NlqModel {
  const next = validateNlqModel(input);
  if (JSON.stringify(next) === JSON.stringify(published)) return structuredClone(published);
  const existing = modelPath();
  const backup = path.join(directory!, 'nlq-model.pre-admin.json');
  if (fs.existsSync(existing) && !fs.existsSync(backup)) {
    fs.copyFileSync(existing, backup, fs.constants.COPYFILE_EXCL);
  }
  atomicWrite(next);
  published = next;
  return structuredClone(published);
}
export function getNlqModelState(): NlqModelState {
  return { published: structuredClone(published) };
}
