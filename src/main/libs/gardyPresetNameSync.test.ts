import { afterEach, describe, expect, test } from 'vitest';

import { setLanguage } from '../i18n';
import { GardyPresetAgentId, PRESET_AGENTS } from '../presetAgents';
import { syncGardyPresetIdentities, syncGardyPresetNames } from './gardyPresetNameSync';

type TestAgent = {
  id: string;
  name: string;
  source: string;
  presetId: string;
};

const createStore = (agents: TestAgent[]) => {
  const byId = new Map(agents.map(agent => [agent.id, agent]));
  const updates: Array<{ id: string; name: string }> = [];
  return {
    updates,
    getAgent: (id: string) => byId.get(id) ?? null,
    updateAgent: (id: string, patch: { name: string }) => {
      const agent = byId.get(id);
      if (!agent) return null;
      agent.name = patch.name;
      updates.push({ id, name: patch.name });
      return agent;
    },
  };
};

afterEach(() => setLanguage('zh'));

describe('GARDY preset name startup sync', () => {
  test('renames the three installed legacy defaults once', () => {
    const store = createStore([
      { id: GardyPresetAgentId.SpreadsheetAnalyst, name: '表格分析助手', source: 'preset', presetId: GardyPresetAgentId.SpreadsheetAnalyst },
      { id: GardyPresetAgentId.DocumentAssistant, name: '文档助手', source: 'preset', presetId: GardyPresetAgentId.DocumentAssistant },
      { id: GardyPresetAgentId.WorkSummaryAssistant, name: '工作总结助手', source: 'preset', presetId: GardyPresetAgentId.WorkSummaryAssistant },
    ]);

    expect(syncGardyPresetNames(store)).toBe(3);
    expect(store.updates).toEqual([
      { id: GardyPresetAgentId.SpreadsheetAnalyst, name: '表格分析专家' },
      { id: GardyPresetAgentId.DocumentAssistant, name: '文档专家' },
      { id: GardyPresetAgentId.WorkSummaryAssistant, name: '工作总结专家' },
    ]);
    expect(syncGardyPresetNames(store)).toBe(0);
  });

  test('respects the current language for an old English default', () => {
    setLanguage('en');
    const store = createStore([
      { id: GardyPresetAgentId.DocumentAssistant, name: 'Document Assistant', source: 'preset', presetId: GardyPresetAgentId.DocumentAssistant },
    ]);

    expect(syncGardyPresetNames(store)).toBe(1);
    expect(store.updates).toEqual([{ id: GardyPresetAgentId.DocumentAssistant, name: 'Document Expert' }]);
  });

  test('preserves customized names and non-preset agents', () => {
    const store = createStore([
      { id: GardyPresetAgentId.DocumentAssistant, name: '合同专员', source: 'preset', presetId: GardyPresetAgentId.DocumentAssistant },
      { id: GardyPresetAgentId.WorkSummaryAssistant, name: '工作总结助手', source: 'custom', presetId: '' },
    ]);

    expect(syncGardyPresetNames(store)).toBe(0);
    expect(store.updates).toEqual([]);
  });
});

describe('GARDY preset identity startup sync', () => {
  test('upgrades an unchanged legacy identity without replacing an edited identity', () => {
    const legacyIdentity = '你是嘉迪团队的文档助手，负责从业务材料中准确提取信息，并协助起草、审校和整理专业文档。你尊重现有模板和原文事实，对未确认的信息明确标注，不擅自设定制度或流程。';
    const agents = new Map([
      [GardyPresetAgentId.DocumentAssistant, {
        id: GardyPresetAgentId.DocumentAssistant,
        source: 'preset',
        presetId: GardyPresetAgentId.DocumentAssistant,
        identity: legacyIdentity,
      }],
      [GardyPresetAgentId.WorkSummaryAssistant, {
        id: GardyPresetAgentId.WorkSummaryAssistant,
        source: 'preset',
        presetId: GardyPresetAgentId.WorkSummaryAssistant,
        identity: '用户定制的工作总结身份',
      }],
    ]);
    const updates: Array<{ id: string; identity: string }> = [];
    const store = {
      getAgent: (id: string) => agents.get(id) ?? null,
      updateAgent: (id: string, patch: { identity: string }) => {
        const agent = agents.get(id);
        if (!agent) return null;
        agent.identity = patch.identity;
        updates.push({ id, identity: patch.identity });
        return agent;
      },
    };

    expect(syncGardyPresetIdentities(store)).toBe(1);
    expect(updates).toEqual([{
      id: GardyPresetAgentId.DocumentAssistant,
      identity: PRESET_AGENTS.find(preset => preset.id === GardyPresetAgentId.DocumentAssistant)?.identity,
    }]);
    expect(agents.get(GardyPresetAgentId.WorkSummaryAssistant)?.identity).toBe('用户定制的工作总结身份');
    expect(syncGardyPresetIdentities(store)).toBe(0);
  });

  test('upgrades an unchanged English identity to the selected language', () => {
    setLanguage('en');
    const agent = {
      id: GardyPresetAgentId.SpreadsheetAnalyst,
      source: 'preset',
      presetId: GardyPresetAgentId.SpreadsheetAnalyst,
      identity: 'You are GARDY\'s spreadsheet analysis assistant. You organize operational records, validate data quality, analyze metrics, and produce clear, reliable Excel workbooks. Follow the field definitions, calculation rules, and templates supplied by the user without inventing business rules.',
    };
    const store = {
      getAgent: (id: string) => id === agent.id ? agent : null,
      updateAgent: (id: string, patch: { identity: string }) => {
        if (id !== agent.id) return null;
        agent.identity = patch.identity;
        return agent;
      },
    };

    expect(syncGardyPresetIdentities(store)).toBe(1);
    expect(agent.identity).toBe(PRESET_AGENTS.find(preset => preset.id === agent.id)?.identityEn);
  });
});
