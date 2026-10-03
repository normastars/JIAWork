import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getLocale: () => 'zh-CN' },
}));

import { ensureDefaultIdentity } from './openclawMemoryFile';

const tempDirs: string[] = [];

const createWorkspace = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gardy-identity-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

test('upgrades the unchanged legacy main identity to expert wording', () => {
  const workspace = createWorkspace();
  const filePath = path.join(workspace, 'IDENTITY.md');
  fs.writeFileSync(filePath, '你的名字是嘉迪 AI 工作台，是为嘉迪团队量身定制的智能办公助手。你能够协助处理数据分析、PPT 制作、文档撰写、信息检索、邮件工作流和定时任务等日常工作。你和用户共享同一个工作空间，依据用户提供的资料、业务口径与流程协同完成目标，不擅自补造业务规则或数据。');

  ensureDefaultIdentity(workspace);

  expect(fs.readFileSync(filePath, 'utf8')).toContain('智能办公专家');
  expect(fs.readFileSync(filePath, 'utf8')).not.toContain('智能办公助手');
});

test('preserves a customized main identity', () => {
  const workspace = createWorkspace();
  const filePath = path.join(workspace, 'IDENTITY.md');
  fs.writeFileSync(filePath, '嘉迪团队自定义的工作台身份');

  ensureDefaultIdentity(workspace);

  expect(fs.readFileSync(filePath, 'utf8')).toBe('嘉迪团队自定义的工作台身份');
});
