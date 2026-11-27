import { describe, expect, test } from 'vitest';

import { resolveAllowedModels } from './enterpriseModelAccess';

describe('resolveAllowedModels', () => {
  test('uses only models allowed by the key and replaces an inaccessible default', () => {
    const result = resolveAllowedModels(
      ['gpt-5.4'],
      [{ id: 'gpt-5-mini', name: 'GPT-5 mini' }],
      'gpt-5-mini',
    );
    expect(result.defaultModel).toBe('gpt-5.4');
    expect(result.models.map(model => model.id)).toEqual(['gpt-5.4']);
  });

  test('keeps an existing default when the key allows it', () => {
    const result = resolveAllowedModels(
      ['gpt-5.4', 'gpt-5-mini'],
      [{ id: 'gpt-5-mini', name: 'GPT-5 mini' }],
      'gpt-5-mini',
    );
    expect(result.defaultModel).toBe('gpt-5-mini');
    expect(result.models[1].name).toBe('GPT-5 mini');
  });
});
