import { getLanguage } from '../i18n';
import { GardyPresetAgentId, PRESET_AGENTS } from '../presetAgents';

type NamedPresetAgent = {
  id: string;
  name: string;
  source: string;
  presetId: string;
};

type PresetAgentStore = {
  getAgent: (id: string) => NamedPresetAgent | null;
  updateAgent: (id: string, updates: { name: string }) => NamedPresetAgent | null;
};

type IdentityPresetAgent = Pick<NamedPresetAgent, 'id' | 'source' | 'presetId'> & {
  identity: string;
};

type PresetIdentityStore = {
  getAgent: (id: string) => IdentityPresetAgent | null;
  updateAgent: (id: string, updates: { identity: string }) => IdentityPresetAgent | null;
};

const LEGACY_DEFAULT_NAMES: Record<string, readonly string[]> = {
  [GardyPresetAgentId.SpreadsheetAnalyst]: ['表格分析助手', 'Spreadsheet Analyst'],
  [GardyPresetAgentId.DocumentAssistant]: ['文档助手', 'Document Assistant'],
  [GardyPresetAgentId.WorkSummaryAssistant]: ['工作总结助手', 'Work Summary Assistant'],
};

/** Update only the bundled names; preserve names customized by employees. */
export const syncGardyPresetNames = (agentStore: PresetAgentStore): number => {
  let updatedCount = 0;

  for (const id of Object.values(GardyPresetAgentId)) {
    const agent = agentStore.getAgent(id);
    const preset = PRESET_AGENTS.find(candidate => candidate.id === id);
    if (!agent || !preset || agent.source !== 'preset' || agent.presetId !== id) continue;
    if (!LEGACY_DEFAULT_NAMES[id]?.includes(agent.name.trim())) continue;

    const name = getLanguage() === 'en' ? preset.nameEn : preset.name;
    if (agentStore.updateAgent(id, { name })) updatedCount++;
  }

  return updatedCount;
};

/** Upgrade untouched bundled identities while preserving employee edits. */
export const syncGardyPresetIdentities = (agentStore: PresetIdentityStore): number => {
  let updatedCount = 0;

  for (const id of Object.values(GardyPresetAgentId)) {
    const agent = agentStore.getAgent(id);
    const preset = PRESET_AGENTS.find(candidate => candidate.id === id);
    if (!agent || !preset || agent.source !== 'preset' || agent.presetId !== id) continue;

    const previousZh = preset.identity.replace('专家，', '助手，');
    const previousEn = preset.identityEn.replace(' expert.', ' assistant.');
    if (agent.identity.trim() !== previousZh && agent.identity.trim() !== previousEn) continue;

    const identity = getLanguage() === 'en' ? preset.identityEn : preset.identity;
    if (agentStore.updateAgent(id, { identity })) updatedCount++;
  }

  return updatedCount;
};
