import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { setLanguage } from './i18n';
import {
  GardyPresetAgentId,
  PRESET_AGENTS,
  presetToCreateRequest,
  resolveGardyPromptDir,
} from './presetAgents';

const getPreset = (id: string) => {
  const preset = PRESET_AGENTS.find(candidate => candidate.id === id);
  if (!preset) {
    throw new Error(`Missing preset agent: ${id}`);
  }
  return preset;
};

afterEach(() => {
  setLanguage('zh');
});

describe('GARDY preset agents', () => {
  test('publishes the first three business presets with the intended bundled skills', () => {
    const expected = [
      {
        id: GardyPresetAgentId.SpreadsheetAnalyst,
        name: '表格分析专家',
        nameEn: 'Spreadsheet Analysis Expert',
        skillIds: ['xlsx'],
      },
      {
        id: GardyPresetAgentId.DocumentAssistant,
        name: '文档专家',
        nameEn: 'Document Expert',
        skillIds: ['docx', 'pdf'],
      },
      {
        id: GardyPresetAgentId.WorkSummaryAssistant,
        name: '工作总结专家',
        nameEn: 'Work Summary Expert',
        skillIds: ['docx', 'xlsx', 'pptx'],
      },
    ];

    for (const fields of expected) {
      const preset = getPreset(fields.id);
      expect(preset).toMatchObject(fields);
      expect(preset.identity).toContain('专家');
      expect(preset.identity).not.toContain('助手');
      expect(preset.identityEn).toMatch(/expert/i);
      expect(preset.identityEn).not.toMatch(/assistant/i);
      for (const skillId of fields.skillIds) {
        expect(existsSync(path.join(process.cwd(), 'SKILLs', skillId, 'SKILL.md'))).toBe(true);
      }
    }
  });

  test('keeps every preset id unique', () => {
    const ids = PRESET_AGENTS.map(preset => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('localizes installed GARDY presets without changing their identity or skills', () => {
    const preset = getPreset(GardyPresetAgentId.DocumentAssistant);

    setLanguage('zh');
    expect(presetToCreateRequest(preset)).toMatchObject({
      id: GardyPresetAgentId.DocumentAssistant,
      presetId: GardyPresetAgentId.DocumentAssistant,
      source: 'preset',
      name: preset.name,
      description: preset.description,
      identity: preset.identity,
      systemPrompt: preset.systemPrompt,
      skillIds: preset.skillIds,
    });

    setLanguage('en');
    expect(presetToCreateRequest(preset)).toMatchObject({
      id: GardyPresetAgentId.DocumentAssistant,
      presetId: GardyPresetAgentId.DocumentAssistant,
      source: 'preset',
      name: preset.nameEn,
      description: preset.descriptionEn,
      identity: preset.identityEn,
      systemPrompt: preset.systemPromptEn,
      skillIds: preset.skillIds,
    });
  });

  test('loads three English prompt files and requires Chinese user-facing output', () => {
    const files = [
      [GardyPresetAgentId.SpreadsheetAnalyst, 'spreadsheet-analyst.md'],
      [GardyPresetAgentId.DocumentAssistant, 'document-assistant.md'],
      [GardyPresetAgentId.WorkSummaryAssistant, 'work-summary-assistant.md'],
    ] as const;

    for (const [id, fileName] of files) {
      const prompt = readFileSync(path.join(process.cwd(), 'resources', 'gardy-prompts', fileName), 'utf8').trim();
      expect(getPreset(id).systemPrompt).toBe(prompt);
      expect(prompt).toMatch(/Communicate and deliver results in Simplified Chinese/);
      expect(prompt).not.toMatch(/[^\x00-\x7F]/);
    }
  });

  test('resolves prompt files from source, TypeScript output, and the packaged main bundle', () => {
    const root = process.cwd();
    const expected = path.join(root, 'resources', 'gardy-prompts');

    expect(resolveGardyPromptDir(path.join(root, 'src', 'main'))).toBe(expected);
    expect(resolveGardyPromptDir(path.join(root, 'dist-electron', 'src', 'main'))).toBe(expected);
    expect(resolveGardyPromptDir(path.join(root, 'dist-electron'))).toBe(expected);
  });
});
