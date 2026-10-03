import { createHash } from 'crypto';

import { GardyPresetAgentId, PRESET_AGENTS } from '../presetAgents';

const GARDY_PRESET_PROMPT_HASHES_KEY = 'gardy_preset_prompt_default_hashes';

type PromptAgent = {
  id: string;
  source: string;
  presetId: string;
  systemPrompt: string;
};

type PromptAgentStore = {
  getAgent: (id: string) => PromptAgent | null;
  updateAgent: (id: string, updates: { systemPrompt: string }) => PromptAgent | null;
};

type PromptMetadataStore = {
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, value: T) => void;
};

// Prompts bundled before the three Markdown files were introduced. These
// fingerprints let existing default presets upgrade without replacing edits.
const LEGACY_DEFAULT_HASHES: Record<string, readonly string[]> = {
  [GardyPresetAgentId.SpreadsheetAnalyst]: [
    'ea1996ad2dd82ef3fa10ba6e806b686cbf5252991a7a92ca7704d38b30822184',
    '124284ea8eb9091155f60d281ee38016781569b34b494a54c9b1a84833f37b46',
    '1053618e912b34d404c2a191dfc3777709b2dd9fd47d6d1357459785789da820',
    '5700505e168b142ea2c23d18b180c930f38eea888dfb5576a0ff78ace90bb998',
  ],
  [GardyPresetAgentId.DocumentAssistant]: [
    '7955b463e3a0e9603a46d8daf59dac7e51c4a1ba186df10eb64c013c3ab12ab8',
    'e4f8169031d35feb0586d93b4c49a71d813a63cc3c714480db662053be5c393e',
    'd522433e13d70cd3985dbcb41cd975bb1951c909c71121f475548c4d9de4676e',
    'ecb97844ae3330fcebe3b2ced4da76f71302f2523e899d63482144e536712e1d',
  ],
  [GardyPresetAgentId.WorkSummaryAssistant]: [
    '1116209c140cb889e204f908490bf767cdc38405ed3e168f849437aeb218c145',
    '4bc3afd257c2fd5bf706b494638495e53d7f88967e0b69f5264487131cd5f338',
    'a11526a80610ed5aac0f4ef25ee38b9639e2487a1cbae06f0e566244861fe6b6',
    '27c875b945ba767bda5e54a6a9a1d576f8ff2a747cc804349a0294ccfc57802d',
  ],
};

const hashPrompt = (prompt: string): string =>
  createHash('sha256').update(prompt.trim()).digest('hex');

export function syncGardyPresetPrompts(
  store: PromptMetadataStore,
  agentStore: PromptAgentStore,
): number {
  const savedHashes = store.get<Record<string, string>>(GARDY_PRESET_PROMPT_HASHES_KEY) ?? {};
  const nextHashes: Record<string, string> = {};
  let updatedCount = 0;

  for (const id of Object.values(GardyPresetAgentId)) {
    const preset = PRESET_AGENTS.find(candidate => candidate.id === id);
    if (!preset) continue;

    const defaultHash = hashPrompt(preset.systemPrompt);
    nextHashes[id] = defaultHash;
    const agent = agentStore.getAgent(id);
    if (!agent || agent.source !== 'preset' || agent.presetId !== id) continue;

    const currentHash = hashPrompt(agent.systemPrompt);
    if (currentHash === defaultHash) continue;
    const wasDefault = currentHash === savedHashes[id]
      || LEGACY_DEFAULT_HASHES[id]?.includes(currentHash);
    if (!wasDefault) continue;

    if (agentStore.updateAgent(id, { systemPrompt: preset.systemPrompt })) {
      updatedCount++;
    }
  }

  if (Object.keys(nextHashes).some(id => savedHashes[id] !== nextHashes[id])) {
    store.set(GARDY_PRESET_PROMPT_HASHES_KEY, nextHashes);
  }
  return updatedCount;
}
