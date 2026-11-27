import React, { useState } from 'react';

import { i18nService } from '../../services/i18n';

interface GardyModelConfigProps {
  baseUrl: string;
  apiKey: string;
  onChange: (field: 'baseUrl' | 'apiKey', value: string) => void;
}

const GardyModelConfig: React.FC<GardyModelConfigProps> = ({ baseUrl, apiKey, onChange }) => {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label htmlFor="gardy-api-url" className="mb-2 block text-sm font-medium text-foreground">
          {i18nService.t('settingsApiAddress')}
        </label>
        <input
          id="gardy-api-url"
          type="url"
          required
          value={baseUrl}
          onChange={event => onChange('baseUrl', event.target.value)}
          placeholder={i18nService.t('baseUrlPlaceholder')}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="gardy-api-key" className="mb-2 block text-sm font-medium text-foreground">
          {i18nService.t('apiKey')}
        </label>
        <div className="flex gap-2">
          <input
            id="gardy-api-key"
            type={showApiKey ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={apiKey}
            onChange={event => onChange('apiKey', event.target.value)}
            placeholder={i18nService.t('apiKeyPlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(value => !value)}
            className="rounded-xl border border-border px-3 text-sm text-secondary hover:text-foreground"
          >
            {i18nService.t(showApiKey ? 'hide' : 'show')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GardyModelConfig;
