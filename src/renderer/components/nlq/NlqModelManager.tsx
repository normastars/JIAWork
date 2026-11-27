import type { NlqModelState } from '@shared/nlq/constants';
import React, { useCallback, useEffect, useState } from 'react';

import { i18nService } from '../../services/i18n';

type DatabaseStatus = Awaited<ReturnType<typeof window.electron.nlq.status>>;

/** Read-only desktop view; model authoring and publishing now live in Admin. */
export const NlqModelManager: React.FC = () => {
  const t = i18nService.t.bind(i18nService);
  const [model, setModel] = useState<NlqModelState | null>(null);
  const [database, setDatabase] = useState<DatabaseStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [modelState, databaseStatus] = await Promise.all([
        window.electron.nlq.model(),
        window.electron.nlq.status(),
      ]);
      setModel(modelState);
      setDatabase(databaseStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <div className="mx-auto max-w-2xl space-y-5 pb-8">
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{t('settingsDataModel')}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{t('nlqAdminManaged')}</p>
    </div>
    <div className="rounded-xl border border-border bg-surface-raised/40 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{model?.published.name ?? t('nlqLoadingModel')}</p>
          {model && <p className="mt-1 text-xs text-muted-foreground">{t('nlqPublishedVersion')} {model.published.version} · {t('nlqTables')} {Object.keys(model.published.tables).length} · {t('nlqMetrics')} {Object.keys(model.published.metrics).length}</p>}
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised disabled:opacity-50">
          {t('nlqRefreshModel')}
        </button>
      </div>
      {database && <p className={`text-sm ${database.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
        {t('nlqDatabaseStatus')}：{database.message}
      </p>}
      {model?.syncError && <p role="alert" className="text-sm text-red-600">{t('nlqModelSyncFailed')}：{model.syncError}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {model?.adminUrl && <button type="button" onClick={() => void window.electron.shell.openExternal(model.adminUrl!)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        {t('nlqOpenAdmin')}
      </button>}
    </div>
  </div>;
};
