import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { GardyPresetAgentId, PRESET_AGENTS } from '../presetAgents';
import { syncGardyPresetPrompts } from './gardyPresetPromptSync';

const firstId = GardyPresetAgentId.SpreadsheetAnalyst;

const hashPrompt = (prompt: string): string =>
  createHash('sha256').update(prompt.trim()).digest('hex');

const createHarness = (prompt: string, previousDefaultHash?: string) => {
  const agent = {
    id: firstId,
    source: 'preset',
    presetId: firstId,
    systemPrompt: prompt,
  };
  const saved = new Map<string, unknown>();
  if (previousDefaultHash) {
    saved.set('gardy_preset_prompt_default_hashes', { [firstId]: previousDefaultHash });
  }
  let updateCount = 0;
  const store = {
    get: <T>(key: string): T | undefined => saved.get(key) as T | undefined,
    set: <T>(key: string, value: T): void => { saved.set(key, value); },
  };
  const agentStore = {
    getAgent: (id: string) => id === firstId ? agent : null,
    updateAgent: (id: string, updates: { systemPrompt: string }) => {
      if (id !== firstId) return null;
      agent.systemPrompt = updates.systemPrompt;
      updateCount++;
      return agent;
    },
  };
  return { agent, store, agentStore, getUpdateCount: () => updateCount };
};

describe('GARDY preset prompt startup sync', () => {
  test('upgrades a previous bundled default once', () => {
    const previousPrompt = 'Previous bundled default prompt';
    const harness = createHarness(previousPrompt, hashPrompt(previousPrompt));
    const currentPrompt = PRESET_AGENTS.find(preset => preset.id === firstId)?.systemPrompt;

    expect(syncGardyPresetPrompts(harness.store, harness.agentStore)).toBe(1);
    expect(harness.agent.systemPrompt).toBe(currentPrompt);
    expect(syncGardyPresetPrompts(harness.store, harness.agentStore)).toBe(0);
    expect(harness.getUpdateCount()).toBe(1);
  });

  test('preserves a prompt edited by the user', () => {
    const harness = createHarness('My custom instructions', hashPrompt('Previous bundled default prompt'));

    expect(syncGardyPresetPrompts(harness.store, harness.agentStore)).toBe(0);
    expect(harness.agent.systemPrompt).toBe('My custom instructions');
    expect(harness.getUpdateCount()).toBe(0);
  });
});
