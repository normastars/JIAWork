import type {
  NlqDimension,
  NlqModel,
  NlqQueryResult,
  NlqQueryRow,
  NlqQuerySpec,
} from '../../shared/nlq/constants';
import { getPublishedNlqModel } from './modelStore';
import {
  catalog,
  comparisonPeriod,
  compileMembers,
  compileQuery,
  metricDefinition,
  normalizeSpec,
  type SqlStatement,
} from './semantic';
import { runSelect } from './sqlServerRunner';

export type SelectRunner = (statement: SqlStatement) => Promise<Array<Record<string, unknown>>>;

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('数据库返回了无效数值');
  return number;
}

function dateValue(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return undefined;
}

function mapRows(rows: Array<Record<string, unknown>>, groupBy: NlqDimension[]): NlqQueryRow[] {
  return rows.flatMap(row => {
    const value = numberValue(row.value);
    if (value === null) return [];
    return [{
      ...Object.fromEntries(groupBy.map(dim => [dim, row[dim] == null ? null : String(row[dim])])),
      value,
    }];
  });
}

function keyFor(row: NlqQueryRow, groupBy: NlqDimension[]): string {
  return JSON.stringify(groupBy.map(dim => row[dim]));
}

export async function queryNlq(input: unknown, runner: SelectRunner = runSelect, model: NlqModel = getPublishedNlqModel()): Promise<NlqQueryResult> {
  const spec = normalizeSpec(input, model);
  const groupBy = spec.group_by ?? [];
  const metric = metricDefinition(spec.metric, model);
  const statements: SqlStatement[] = [];
  const mainStatement = compileQuery(spec, {}, model);
  statements.push(mainStatement);
  const raw = await runner(mainStatement);
  const rows = mapRows(raw, groupBy);
  const warnings: string[] = [];
  if (rows.length === 0) warnings.push('该期间没有可用记录；不能将无数据解释为零');
  if (groupBy.length && rows.length === (spec.limit ?? 50)) {
    warnings.push('结果已达到返回行数上限，可能还有其他分组');
  }

  let total: number | undefined;
  if (groupBy.length === 0) {
    total = rows[0]?.value;
  } else if (spec.with_total) {
    const totalStatement = compileQuery(spec, { groupBy: [], limit: 1 }, model);
    statements.push(totalStatement);
    const totalRows = await runner(totalStatement);
    total = numberValue(totalRows[0]?.value) ?? undefined;
  }

  if (spec.share && total !== undefined) {
    for (const row of rows) row.sharePercent = total === 0 ? 0 : Number((row.value / total * 100).toFixed(2));
  }

  let comparison: NlqQueryResult['comparison'];
  const previousPeriod = comparisonPeriod(spec);
  if (previousPeriod) {
    const previousStatement = compileQuery(spec, { period: previousPeriod, limit: 100 }, model);
    statements.push(previousStatement);
    const previousRows = mapRows(await runner(previousStatement), groupBy);
    if (groupBy.length === 0) {
      const current = rows[0]?.value;
      const previous = previousRows[0]?.value;
      if (current !== undefined && previous !== undefined) {
        const difference = Number((current - previous).toFixed(4));
        comparison = {
          previous,
          difference,
          changePercent: previous === 0 ? null : Number((difference / Math.abs(previous) * 100).toFixed(2)),
        };
      } else {
        warnings.push('对比期间缺少数据，无法计算同比或环比');
      }
    } else {
      const previousByKey = new Map(previousRows.map(row => [keyFor(row, groupBy), row.value]));
      for (const row of rows) {
        const previous = previousByKey.get(keyFor(row, groupBy));
        if (previous === undefined) continue;
        const difference = Number((row.value - previous).toFixed(4));
        row.previous = previous;
        row.difference = difference;
        row.changePercent = previous === 0 ? null : Number((difference / Math.abs(previous) * 100).toFixed(2));
      }
      if (previousRows.length === 0) warnings.push('对比期间缺少数据，无法计算同比或环比');
    }
  }

  const dataAsOf = raw.map(row => dateValue(row.data_as_of)).filter((value): value is string => Boolean(value)).sort().at(-1);
  return {
    spec,
    metricLabel: metric.label,
    unit: metric.unit,
    rows,
    ...(total !== undefined ? { total } : {}),
    ...(comparison ? { comparison } : {}),
    notes: metric.notes,
    warnings,
    sql: statements.map(statement => ({ text: statement.text, parameters: statement.parameters })),
    ...(dataAsOf ? { dataAsOf } : {}),
  };
}

export async function findNlqMembers(
  dimension: NlqDimension,
  keyword = '',
  runner: SelectRunner = runSelect,
  model: NlqModel = getPublishedNlqModel(),
): Promise<{ dimension: NlqDimension; matches: Array<{ value: string; rows: number }> }> {
  if (typeof keyword !== 'string' || keyword.length > 100) throw new Error('成员关键词过长');
  const statements = compileMembers(dimension, keyword, model);
  const totals = new Map<string, number>();
  for (const statement of statements) {
    for (const row of await runner(statement)) {
      const value = String(row.value ?? '');
      if (value) totals.set(value, (totals.get(value) ?? 0) + (numberValue(row.rows) ?? 0));
    }
  }
  return {
    dimension,
    matches: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([value, rows]) => ({ value, rows })),
  };
}

export { catalog as getNlqCatalog };
export type { NlqQuerySpec };
