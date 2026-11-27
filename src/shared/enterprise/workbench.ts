export type EnterpriseLocalizedText = {
  zh: string;
  en: string;
};

export type EnterpriseWorkbenchQuickAction = {
  id: string;
  label: EnterpriseLocalizedText;
  description?: EnterpriseLocalizedText;
  prompt: EnterpriseLocalizedText;
  agentId?: string;
  skillId?: string;
};

export type EnterpriseWorkbenchConfig = {
  title?: EnterpriseLocalizedText;
  tagline?: EnterpriseLocalizedText;
  quickActions?: EnterpriseWorkbenchQuickAction[];
};
