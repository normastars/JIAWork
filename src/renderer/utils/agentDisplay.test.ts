import { afterEach, expect, test } from 'vitest';

import { i18nService } from '../services/i18n';
import { getAgentDisplayName } from './agentDisplay';

afterEach(() => i18nService.setLanguage('zh', { persist: false }));

test('shows the current expert title for a previously saved main agent name', () => {
  i18nService.setLanguage('zh', { persist: false });
  expect(getAgentDisplayName({ id: 'main', name: '嘉迪助手' })).toBe('嘉迪专家');

  i18nService.setLanguage('en', { persist: false });
  expect(getAgentDisplayName({ id: 'main', name: '嘉迪助手' })).toBe('GARDY Expert');
});

test('preserves a custom main expert name', () => {
  expect(getAgentDisplayName({ id: 'main', name: '我的办公室专家' })).toBe('我的办公室专家');
});
