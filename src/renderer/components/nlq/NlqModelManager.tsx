import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import type { NlqDatabaseTable, NlqModel, NlqQueryResult } from '@shared/nlq/constants';
import React, { useEffect, useState } from 'react';

import { copyTextToClipboard } from '../../services/clipboard';
import { i18nService } from '../../services/i18n';

const fieldClass = 'w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary';
const buttonClass = 'inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50';
const panelClass = 'space-y-4';
const dateTypes = new Set(['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset']);
const numberTypes = new Set(['bigint', 'int', 'smallint', 'tinyint', 'decimal', 'numeric', 'money', 'smallmoney', 'float', 'real']);

function nextId(prefix: string, existing: Record<string, unknown>): string {
  let index = 1;
  while (Object.prototype.hasOwnProperty.call(existing, `${prefix}_${index}`)) index += 1;
  return `${prefix}_${index}`;
}

function columnsOf(schema: NlqDatabaseTable[], name: string): NlqDatabaseTable['columns'] {
  return schema.find(table => table.name === name)?.columns ?? [];
}

export const NlqModelManager: React.FC<{ onPublished?: () => void }> = ({ onPublished }) => {
  const t = i18nService.t.bind(i18nService);
  const [draft, setDraft] = useState<NlqModel | null>(null);
  const [publishedModel, setPublishedModel] = useState<NlqModel | null>(null);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [schema, setSchema] = useState<NlqDatabaseTable[]>([]);
  const [schemaError, setSchemaError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<NlqQueryResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [newDimensionLabel, setNewDimensionLabel] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [activeSection, setActiveSection] = useState<'tables' | 'dimensions' | 'relations' | 'metrics' | 'publish'>('tables');

  useEffect(() => {
    let active = true;
    void window.electron.nlq.model().then(value => {
      if (active) {
        setDraft(value.draft);
        setPublishedModel(value.published);
        setPublishedVersion(value.published.version);
        setSelectedMetric(Object.keys(value.draft.metrics)[0] ?? '');
      }
    }).catch(caught => { if (active) setError(String(caught)); });
    void window.electron.nlq.schema().then(value => { if (active) setSchema(value); })
      .catch(caught => { if (active) setSchemaError(String(caught)); });
    return () => { active = false; };
  }, []);

  const change = (update: (copy: NlqModel) => void) => {
    setDraft(previous => {
      if (!previous) return previous;
      const copy = structuredClone(previous);
      update(copy);
      return copy;
    });
    setDirty(true);
    setPreviewReady(false);
    setPreview(null);
    setCopiedSql(false);
    setMessage('');
  };

  useEffect(() => {
    if (!draft) return;
    if (!Object.prototype.hasOwnProperty.call(draft.metrics, selectedMetric)) {
      setSelectedMetric(Object.keys(draft.metrics)[0] ?? '');
      setPreviewReady(false);
    }
  }, [draft, selectedMetric]);

  const action = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await run(); } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  };

  const save = async (): Promise<void> => {
    if (!draft) return;
    const saved = await window.electron.nlq.saveDraft(draft);
    setDraft(saved);
    setDirty(false);
    setMessage(t('nlqDraftSaved'));
  };

  const tableEntries = draft ? Object.entries(draft.tables) : [];
  const metricEntries = draft ? Object.entries(draft.metrics) : [];
  const hasPendingChanges = draft && publishedModel
    ? JSON.stringify(draft) !== JSON.stringify(publishedModel)
    : false;
  const sqlCopyText = preview?.sql.map((statement, index) => [
    `-- SQL ${index + 1}`,
    statement.text,
    `-- ${t('nlqSqlParameters')}`,
    JSON.stringify(statement.parameters, null, 2),
  ].join('\n')).join('\n\n') ?? '';

  if (!draft) return <div className="text-sm text-muted-foreground">{error || t('nlqLoadingModel')}</div>;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="truncate text-base font-semibold text-foreground">{draft.name}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary-muted px-2.5 py-1 font-medium text-primary">{t('nlqPublishedVersion')} {publishedVersion}</span>
            {dirty && <span>{t('nlqUnsavedChanges')}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void action(async () => {
            const result = await window.electron.nlq.schema();
            setSchema(result);
            setSchemaError('');
          })}>{t('nlqRefreshSchema')}</button>
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !dirty} onClick={() => void action(save)}>{t('nlqSaveDraft')}</button>
        </div>
      </div>
      {schemaError && <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600">{t('nlqSchemaUnavailable')}: {schemaError}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-600">{message}</p>}
      <nav className="flex gap-5 overflow-x-auto border-b border-border" aria-label={t('nlqModelTitle')}>
        {([
          ['tables', t('nlqTables'), tableEntries.length], ['dimensions', t('nlqDimensions'), Object.keys(draft.dimensions).length],
          ['relations', t('nlqRelations'), Object.keys(draft.relations).length], ['metrics', t('nlqMetrics'), metricEntries.length],
          ['publish', t('nlqVerifyPublish'), null],
        ] as const).map(([id, label, count]) => <button key={id} type="button" onClick={() => setActiveSection(id)}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm transition-colors ${activeSection === id ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          {label}{count !== null && <span className="text-xs opacity-70">{count}</span>}
        </button>)}
      </nav>

      {activeSection === 'tables' && <section className={`${panelClass} space-y-4`}>
        <header className="space-y-1">
          <h2 className="font-semibold text-foreground">{t('nlqTables')}</h2>
          <p className="text-xs text-muted-foreground">{t('nlqTableHint')}</p>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className={`${fieldClass} sm:flex-1`} value={selectedTable} onChange={event => setSelectedTable(event.target.value)}>
            <option value="">{t('nlqSelectTable')}</option>
            {schema.filter(item => !tableEntries.some(([, table]) => table.name === item.name)).map(table =>
              <option key={table.name} value={table.name}>{table.name}</option>)}
          </select>
          <button className={`${buttonClass} shrink-0`} disabled={!selectedTable} onClick={() => {
            const name = selectedTable;
            change(copy => {
              copy.tables[nextId('table', copy.tables)] = {
                name,
                dateColumn: columnsOf(schema, name).find(column => dateTypes.has(column.dataType.toLowerCase()))?.name,
                dimensions: {},
              };
            });
            setSelectedTable('');
          }}>{t('nlqAddTable')}</button>
        </div>
        {tableEntries.map(([id, table]) => {
          const columns = columnsOf(schema, table.name);
          return <details key={id} className="group rounded-lg border border-border bg-background text-sm transition-colors hover:border-primary/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-foreground marker:hidden">
              <span className="min-w-0 truncate font-medium">{table.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{t('nlqDateColumn')}: {table.dateColumn || t('nlqNoDateColumn')} · {Object.keys(table.dimensions).length} {t('nlqDimensions')} <span aria-hidden="true">⌄</span></span>
            </summary>
            <div className="space-y-4 border-t border-border px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t('nlqTableId')}: {id}</span>
                <button className="text-xs text-red-600 hover:underline" onClick={() => change(copy => {
                delete copy.tables[id];
                for (const [key, relation] of Object.entries(copy.relations)) {
                  if (relation.fromTable === id || relation.toTable === id) delete copy.relations[key];
                }
                for (const [key, metric] of Object.entries(copy.metrics)) if (metric.table === id) delete copy.metrics[key];
              })}>{t('delete')}</button>
              </div>
              <label className="block space-y-1 text-xs text-muted-foreground">
                <span>{t('nlqDateColumn')}</span>
                <select className={fieldClass} value={table.dateColumn ?? ''} onChange={event => change(copy => {
                copy.tables[id].dateColumn = event.target.value || undefined;
                })}>
                  <option value="">{t('nlqNoDateColumn')}</option>
                  {columns.filter(column => dateTypes.has(column.dataType.toLowerCase())).map(column =>
                    <option key={column.name} value={column.name}>{column.name}</option>)}
                </select>
              </label>
              <div className="border-t border-border pt-3">
                <div className="mb-3 text-xs font-medium text-foreground">{t('nlqDimensions')}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(draft.dimensions).map(([dimension, definition]) => <label key={dimension} className="block space-y-1 text-xs text-muted-foreground">
                  <span>{definition.label}</span>
                  <select className={fieldClass} value={table.dimensions[dimension] ?? ''} onChange={event => change(copy => {
                  if (event.target.value) copy.tables[id].dimensions[dimension] = event.target.value;
                  else delete copy.tables[id].dimensions[dimension];
                  })}>
                    <option value="">{t('nlqUnmapped')}</option>
                    {columns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}
                  </select>
                </label>)}
                </div>
              </div>
            </div>
          </details>;
        })}
      </section>}

      {activeSection === 'dimensions' && <section className={`${panelClass} space-y-4`}>
        <header className="space-y-1">
          <h2 className="font-semibold text-foreground">{t('nlqDimensions')}</h2>
          <p className="text-xs text-muted-foreground">{t('nlqDimensionHint')}</p>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`${fieldClass} sm:flex-1`} value={newDimensionLabel} placeholder={t('nlqDimensionName')}
            onChange={event => setNewDimensionLabel(event.target.value)} />
          <button className={buttonClass} disabled={!newDimensionLabel.trim()} onClick={() => {
            const label = newDimensionLabel.trim();
            change(copy => { copy.dimensions[nextId('dimension', copy.dimensions)] = { label, aliases: [] }; });
            setNewDimensionLabel('');
          }}>{t('nlqAddDimension')}</button>
        </div>
        {Object.entries(draft.dimensions).map(([id, definition]) => <div key={id} className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t('nlqDimensionName')} · {id}</span>
            <input className={fieldClass} value={definition.label}
              onChange={event => change(copy => { copy.dimensions[id].label = event.target.value; })} />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t('nlqAliases')}</span>
            <input className={fieldClass} value={definition.aliases.join('、')} placeholder={t('nlqAliases')}
              onChange={event => change(copy => { copy.dimensions[id].aliases = event.target.value.split(/[、,，]/).map(item => item.trim()).filter(Boolean); })} />
          </label>
          <button className={buttonClass} onClick={() => change(copy => {
            delete copy.dimensions[id];
            for (const table of Object.values(copy.tables)) delete table.dimensions[id];
          })}>{t('delete')}</button>
        </div>)}
      </section>}

      {activeSection === 'relations' && <section className={`${panelClass} space-y-4`}>
        <header className="space-y-1">
          <h2 className="font-semibold text-foreground">{t('nlqRelations')}</h2>
          <p className="text-xs text-muted-foreground">{t('nlqRelationHint')}</p>
        </header>
        <button className={buttonClass} disabled={tableEntries.length < 2} onClick={() => change(copy => {
          const [fromTable, toTable] = Object.keys(copy.tables);
          copy.relations[nextId('relation', copy.relations)] = {
            fromTable, toTable, fromColumn: '', toColumn: '', cardinality: 'many_to_one',
          };
        })}>{t('nlqAddRelation')}</button>
        {Object.entries(draft.relations).map(([id, relation]) => <div key={id} className="space-y-4 rounded-lg border border-border bg-background p-4 text-sm">
          <div className="flex items-center justify-between">
            <strong className="text-foreground">{id}</strong>
            <button className="text-xs text-red-600 hover:underline" onClick={() => change(copy => { delete copy.relations[id]; })}>{t('delete')}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="text-xs font-medium text-foreground">{t('nlqRelationSource')}</div>
              <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqTables')}</span>
                <select className={fieldClass} value={relation.fromTable} onChange={event => change(copy => {
                  copy.relations[id].fromTable = event.target.value;
                  copy.relations[id].fromColumn = '';
                })}>{tableEntries.map(([key, table]) => <option key={key} value={key}>{table.name}</option>)}</select>
              </label>
              <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqChooseColumn')}</span>
                <select className={fieldClass} value={relation.fromColumn} onChange={event => change(copy => { copy.relations[id].fromColumn = event.target.value; })}>
                  <option value="">{t('nlqChooseColumn')}</option>
                  {columnsOf(schema, draft.tables[relation.fromTable]?.name ?? '').map(column => <option key={column.name} value={column.name}>{column.name}</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="text-xs font-medium text-foreground">{t('nlqRelationTarget')}</div>
              <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqTables')}</span>
                <select className={fieldClass} value={relation.toTable} onChange={event => change(copy => {
                  copy.relations[id].toTable = event.target.value;
                  copy.relations[id].toColumn = '';
                })}>{tableEntries.map(([key, table]) => <option key={key} value={key}>{table.name}</option>)}</select>
              </label>
              <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqChooseColumn')}</span>
                <select className={fieldClass} value={relation.toColumn} onChange={event => change(copy => { copy.relations[id].toColumn = event.target.value; })}>
                  <option value="">{t('nlqChooseColumn')}</option>
                  {columnsOf(schema, draft.tables[relation.toTable]?.name ?? '').map(column => <option key={column.name} value={column.name}>{column.name}</option>)}
                </select>
              </label>
            </div>
          </div>
          <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqRelationType')}</span>
            <select className={fieldClass} value={relation.cardinality} onChange={event => change(copy => {
              copy.relations[id].cardinality = event.target.value as typeof relation.cardinality;
            })}>
              <option value="many_to_one">{t('nlqManyToOne')}</option>
              <option value="one_to_one">{t('nlqOneToOne')}</option>
              <option value="one_to_many">{t('nlqOneToMany')}</option>
            </select>
          </label>
        </div>)}
      </section>}

      {activeSection === 'metrics' && <section className={`${panelClass} space-y-4`}>
        <header className="space-y-1">
          <h2 className="font-semibold text-foreground">{t('nlqMetrics')}</h2>
          <p className="text-xs text-muted-foreground">{t('nlqMetricHint')}</p>
        </header>
        <button className={buttonClass} disabled={!tableEntries.some(([, table]) => table.dateColumn)} onClick={() => change(copy => {
          const tableId = Object.keys(copy.tables).find(id => copy.tables[id].dateColumn)!;
          const firstNumber = columnsOf(schema, copy.tables[tableId].name).find(column => numberTypes.has(column.dataType.toLowerCase()));
          copy.metrics[nextId('metric', copy.metrics)] = {
            label: t('nlqNewMetric'), table: tableId, column: firstNumber?.name ?? '',
            type: 'flow', unit: t('nlqDefaultUnit'), notes: [],
          };
        })}>{t('nlqAddMetric')}</button>
        {metricEntries.map(([id, metric]) => {
          const columns = columnsOf(schema, draft.tables[metric.table]?.name ?? '').filter(column => numberTypes.has(column.dataType.toLowerCase()));
          return <details key={id} className="rounded-lg border border-border bg-background text-sm transition-colors hover:border-primary/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:hidden">
              <span className="font-medium text-foreground">{metric.label}</span>
              <span className="text-xs text-muted-foreground">{metric.type === 'snapshot' ? t('nlqSnapshot') : t('nlqFlow')} · {metric.unit} ▾</span>
            </summary>
            <div className="space-y-4 border-t border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{id}</span>
                <button className="text-xs text-red-600 hover:underline" onClick={() => change(copy => { delete copy.metrics[id]; })}>{t('delete')}</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqMetricName')}</span>
                  <input className={fieldClass} value={metric.label} onChange={event => change(copy => { copy.metrics[id].label = event.target.value; })} />
                </label>
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqTables')}</span>
                  <select className={fieldClass} value={metric.table} onChange={event => change(copy => {
                    copy.metrics[id].table = event.target.value;
                    copy.metrics[id].column = '';
                    delete copy.metrics[id].subtractColumn;
                  })}>{tableEntries.filter(([, table]) => table.dateColumn).map(([key, table]) => <option key={key} value={key}>{table.name}</option>)}</select>
                </label>
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqValueColumn')}</span>
                  <select className={fieldClass} value={metric.column} onChange={event => change(copy => { copy.metrics[id].column = event.target.value; })}>
                    <option value="">{t('nlqValueColumn')}</option>
                    {columns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqSubtractColumn')}</span>
                  <select className={fieldClass} value={metric.subtractColumn ?? ''} onChange={event => change(copy => {
                    if (event.target.value) copy.metrics[id].subtractColumn = event.target.value;
                    else delete copy.metrics[id].subtractColumn;
                  })}>
                    <option value="">{t('nlqNoSubtract')}</option>
                    {columns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}
                  </select>
                </label>
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqMetricType')}</span>
                  <select className={fieldClass} value={metric.type} onChange={event => change(copy => { copy.metrics[id].type = event.target.value as typeof metric.type; })}>
                    <option value="flow">{t('nlqFlow')}</option>
                    <option value="snapshot">{t('nlqSnapshot')}</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqUnit')}</span>
                  <input className={fieldClass} value={metric.unit} onChange={event => change(copy => { copy.metrics[id].unit = event.target.value; })} />
                </label>
              </div>
              <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqMetricNotes')}</span>
                <textarea className={fieldClass} rows={3} value={metric.notes.join('\n')}
                  onChange={event => change(copy => { copy.metrics[id].notes = event.target.value.split('\n').map(item => item.trim()).filter(Boolean); })} />
              </label>
            </div>
          </details>;
        })}
      </section>}

      {activeSection === 'publish' && <section className={`${panelClass} space-y-4`}>
        <header className="space-y-1">
          <h2 className="font-semibold text-foreground">{t('nlqVerifyPublish')}</h2>
          <p className="text-xs text-muted-foreground">{t('nlqVerifyHint')}</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqMetric')}</span>
            <select className={fieldClass} value={selectedMetric} onChange={event => { setSelectedMetric(event.target.value); setPreviewReady(false); setPreview(null); setCopiedSql(false); }}>
              {metricEntries.map(([id, metric]) => <option key={id} value={id}>{metric.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground"><span>{t('nlqPeriod')}</span>
            <input type="month" className={fieldClass} value={period} onChange={event => { setPeriod(event.target.value); setPreviewReady(false); setPreview(null); setCopiedSql(false); }} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={busy || !selectedMetric || !period} onClick={() => void action(async () => {
            if (dirty) await save();
            const result = await window.electron.nlq.preview({ metric: selectedMetric, period: { from: period, to: period } });
            setPreview(result);
            setCopiedSql(false);
            setPreviewReady(true);
            setMessage(t('nlqPreviewSuccess'));
          })}>{t('nlqPreview')}</button>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={busy || dirty || !previewReady || !hasPendingChanges} onClick={() => void action(async () => {
            const published = await window.electron.nlq.publish();
            setDraft(published);
            setPublishedModel(published);
            setPublishedVersion(published.version);
            setPreviewReady(false);
            setMessage(t('nlqPublishSuccess'));
            onPublished?.();
          })}>{t('nlqPublish')}</button>
        </div>
        {preview && <div className="space-y-2 rounded-lg border border-border bg-background p-4 text-sm text-foreground">
          <p>{preview.metricLabel}: {preview.total ?? t('nlqNoData')} {preview.unit} · {t('nlqRows')}: {preview.rows.length}</p>
          {preview.warnings.map(warning => <p key={warning} className="text-amber-600">{warning}</p>)}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t('nlqExecutedSql')}</h3>
              <button type="button" className={buttonClass} disabled={!sqlCopyText} onClick={() => void copyTextToClipboard(sqlCopyText).then(copied => {
                if (copied) setCopiedSql(true);
                else setError(t('copyFailed'));
              })}>
                {copiedSql ? <CheckIcon className="mr-1.5 h-4 w-4" /> : <ClipboardDocumentIcon className="mr-1.5 h-4 w-4" />}
                {copiedSql ? t('copied') : t('nlqCopySqlAndParameters')}
              </button>
            </div>
            {preview.sql.map((statement, index) => <div key={index} className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-surface-raised/40 px-3 py-2 text-xs font-medium text-muted-foreground">SQL {index + 1}</div>
              <pre className="select-text whitespace-pre-wrap break-words px-3 py-3 font-mono text-xs leading-5 text-foreground">{statement.text}</pre>
              {Object.keys(statement.parameters).length > 0 && <div className="border-t border-border px-3 py-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">{t('nlqSqlParameters')}</div>
                <pre className="select-text whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground">{JSON.stringify(statement.parameters, null, 2)}</pre>
              </div>}
            </div>)}
          </section>
        </div>}
      </section>}
    </div>
  );
};
