import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import type { EnterpriseWorkbenchConfig } from '../../shared/enterprise/workbench';
import {
  localizeEnterpriseWorkbench,
  resolveEnterpriseLocalizedText,
  resolveEnterpriseTaskAgentId,
  resolveEnterpriseTaskSkillIds,
} from './enterpriseWorkbench';

describe('enterpriseWorkbench', () => {
  test('localizes the workbench title, tagline, and quick actions', () => {
    const config: EnterpriseWorkbenchConfig = {
      title: { zh: '企业工作台', en: 'Enterprise Workbench' },
      tagline: { zh: '从一个任务开始', en: 'Start with a task' },
      quickActions: [{
        id: 'spreadsheet-analysis',
        label: { zh: '表格分析', en: 'Spreadsheet Analysis' },
        description: { zh: '汇总数据', en: 'Summarize data' },
        prompt: { zh: '请分析这份表格', en: 'Analyze this spreadsheet' },
        agentId: 'gardy-spreadsheet-analyst',
        skillId: 'xlsx',
      }],
    };

    expect(localizeEnterpriseWorkbench(config, 'zh')).toEqual({
      title: '企业工作台',
      tagline: '从一个任务开始',
      quickActions: [{
        id: 'spreadsheet-analysis',
        label: '表格分析',
        description: '汇总数据',
        prompt: '请分析这份表格',
        agentId: 'gardy-spreadsheet-analyst',
        skillId: 'xlsx',
      }],
    });
  });

  test('falls back to the other language when the requested text is blank', () => {
    expect(resolveEnterpriseLocalizedText({ zh: '', en: 'Fallback' }, 'zh')).toBe('Fallback');
  });

  test('ignores malformed localized values from an unvalidated manifest', () => {
    expect(resolveEnterpriseLocalizedText({ zh: 42, en: 'Fallback' } as never, 'zh'))
      .toBe('Fallback');
  });

  test('drops malformed quick actions received from an unvalidated manifest', () => {
    const config = {
      quickActions: [
        { id: '', label: { zh: '无效', en: 'Invalid' }, prompt: { zh: '提示', en: 'Prompt' } },
        { id: 'missing-prompt', label: { zh: '无效', en: 'Invalid' } },
      ],
    } as EnterpriseWorkbenchConfig;

    expect(localizeEnterpriseWorkbench(config, 'en')?.quickActions).toEqual([]);
  });

  test('selects a task skill only when it is installed and enabled', () => {
    const skills = [
      { id: 'xlsx', enabled: true },
      { id: 'docx', enabled: false },
    ];

    expect(resolveEnterpriseTaskSkillIds('xlsx', skills)).toEqual(['xlsx']);
    expect(resolveEnterpriseTaskSkillIds('docx', skills)).toEqual([]);
    expect(resolveEnterpriseTaskSkillIds('missing', skills)).toEqual([]);
    expect(resolveEnterpriseTaskSkillIds(undefined, skills)).toEqual([]);
  });

  test('routes a task only to an enabled installed assistant', () => {
    const agents = [
      { id: 'gardy-spreadsheet-analyst', enabled: true },
      { id: 'gardy-document-assistant', enabled: false },
    ];

    expect(resolveEnterpriseTaskAgentId('gardy-spreadsheet-analyst', agents))
      .toBe('gardy-spreadsheet-analyst');
    expect(resolveEnterpriseTaskAgentId('gardy-document-assistant', agents))
      .toBeUndefined();
    expect(resolveEnterpriseTaskAgentId('missing', agents)).toBeUndefined();
    expect(resolveEnterpriseTaskAgentId(undefined, agents)).toBeUndefined();
  });

  test('loads the GARDY workbench package with six routed Chinese tasks', () => {
    const manifestPath = path.join(
      process.cwd(),
      'enterprise-configs',
      'gardy',
      'manifest.json',
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      language?: string;
      ui?: Record<string, string>;
      disableUpdate?: boolean;
      disableTelemetry?: boolean;
      autoAcceptPrivacy?: boolean;
      workbench?: EnterpriseWorkbenchConfig;
    };

    expect(manifest.language).toBe('zh');
    expect(manifest.ui?.login).toBe('hide');
    expect(manifest.disableUpdate).toBe(true);
    expect(manifest.disableTelemetry).toBe(true);
    expect(manifest.autoAcceptPrivacy).toBe(true);
    const localized = localizeEnterpriseWorkbench(manifest.workbench, 'zh');
    expect(localized?.title).toBe('嘉迪 AI 工作台');
    expect(localized?.quickActions.map(action => ({
      id: action.id,
      agentId: action.agentId,
      skillId: action.skillId,
    }))).toEqual([
      { id: 'gardy-spreadsheet-analysis', agentId: 'gardy-spreadsheet-analyst', skillId: 'xlsx' },
      { id: 'gardy-document-drafting', agentId: 'gardy-document-assistant', skillId: 'docx' },
      { id: 'gardy-work-summary', agentId: 'gardy-work-summary-assistant', skillId: 'docx' },
      { id: 'gardy-inventory-reconciliation', agentId: 'gardy-spreadsheet-analyst', skillId: 'gardy-inventory' },
      { id: 'gardy-purchase-delivery', agentId: 'gardy-spreadsheet-analyst', skillId: 'xlsx' },
      { id: 'gardy-quality-issue', agentId: 'gardy-document-assistant', skillId: 'docx' },
    ]);
    expect(localized?.quickActions.every(action => action.prompt.startsWith('请'))).toBe(true);
    expect(localized?.quickActions.find(action => action.id === 'gardy-inventory-reconciliation')?.prompt)
      .toContain('无对应记录不等于确认零库存');
  });
});
