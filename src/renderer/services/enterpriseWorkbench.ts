import type {
  EnterpriseLocalizedText,
  EnterpriseWorkbenchConfig,
} from '../../shared/enterprise/workbench';
import type { LanguageType } from './i18n';

export type LocalizedEnterpriseWorkbenchAction = {
  id: string;
  label: string;
  description?: string;
  prompt: string;
  agentId?: string;
  skillId?: string;
};

export type LocalizedEnterpriseWorkbench = {
  title?: string;
  tagline?: string;
  quickActions: LocalizedEnterpriseWorkbenchAction[];
};

export const resolveEnterpriseLocalizedText = (
  value: EnterpriseLocalizedText | undefined,
  language: LanguageType,
): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  const primaryValue = value[language];
  const primary = typeof primaryValue === 'string' ? primaryValue.trim() : '';
  if (primary) return primary;

  const fallbackLanguage = language === 'zh' ? 'en' : 'zh';
  const fallbackValue = value[fallbackLanguage];
  return typeof fallbackValue === 'string' ? fallbackValue.trim() || undefined : undefined;
};

export const localizeEnterpriseWorkbench = (
  config: EnterpriseWorkbenchConfig | null | undefined,
  language: LanguageType,
): LocalizedEnterpriseWorkbench | null => {
  if (!config || typeof config !== 'object') return null;

  const quickActions = Array.isArray(config.quickActions)
    ? config.quickActions.flatMap((action) => {
      if (!action || typeof action !== 'object') return [];

      const id = typeof action.id === 'string' ? action.id.trim() : '';
      const label = resolveEnterpriseLocalizedText(action.label, language);
      const prompt = resolveEnterpriseLocalizedText(action.prompt, language);
      if (!id || !label || !prompt) return [];

      const description = resolveEnterpriseLocalizedText(action.description, language);
      const agentId = typeof action.agentId === 'string' ? action.agentId.trim() : '';
      const skillId = typeof action.skillId === 'string' ? action.skillId.trim() : '';
      return [{
        id,
        label,
        ...(description ? { description } : {}),
        prompt,
        ...(agentId ? { agentId } : {}),
        ...(skillId ? { skillId } : {}),
      }];
    })
    : [];

  return {
    title: resolveEnterpriseLocalizedText(config.title, language),
    tagline: resolveEnterpriseLocalizedText(config.tagline, language),
    quickActions,
  };
};

export const resolveEnterpriseTaskAgentId = (
  agentId: string | undefined,
  agents: Array<{ id: string; enabled: boolean }>,
): string | undefined => {
  if (!agentId) return undefined;
  return agents.some(agent => agent.id === agentId && agent.enabled) ? agentId : undefined;
};

export const resolveEnterpriseTaskSkillIds = (
  skillId: string | undefined,
  skills: Array<{ id: string; enabled: boolean }>,
): string[] => {
  if (!skillId) return [];
  return skills.some(skill => skill.id === skillId && skill.enabled) ? [skillId] : [];
};
