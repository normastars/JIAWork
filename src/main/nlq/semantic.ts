import type { NlqDimension, NlqMetric, NlqModel, NlqQuerySpec } from '../../shared/nlq/constants';
import { getPublishedNlqModel } from './modelStore';

export class NlqSpecError extends Error {}

export type SqlStatement = {
  text: string;
  parameters: Record<string, string | number>;
};

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SPEC_KEYS = new Set(['question', 'metric', 'period', 'group_by', 'filters', 'compare', 'limit', 'with_total', 'share']);

type DimensionSource = { table: string; column: string; relation?: string };

export function availableDimensions(model: NlqModel, baseTable: string): Record<string, DimensionSource> {
  const base = model.tables[baseTable];
  const sources: Record<string, DimensionSource> = Object.create(null);
  for (const [dimension, column] of Object.entries(base.dimensions)) {
    sources[dimension] = { table: baseTable, column };
  }
  for (const [relationId, relation] of Object.entries(model.relations)) {
    if (relation.fromTable !== baseTable || relation.cardinality === 'one_to_many') continue;
    for (const [dimension, column] of Object.entries(model.tables[relation.toTable].dimensions)) {
      if (Object.hasOwn(base.dimensions, dimension)) continue;
      if (Object.hasOwn(sources, dimension)) throw new NlqSpecError(`维度 ${dimension} 关联到多张表，请调整模型`);
      sources[dimension] = { table: relation.toTable, column, relation: relationId };
    }
  }
  return sources;
}

function quotedIdentifier(value: string): string {
  if (!IDENT_RE.test(value)) throw new NlqSpecError('语义模型包含非法 SQL 标识符');
  return `[${value}]`;
}

function quotedTable(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 2) throw new NlqSpecError('语义模型表名必须包含 schema');
  return parts.map(quotedIdentifier).join('.');
}

function monthIndex(value: string): number {
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month - 1;
}

function periodAt(index: number): string {
  const year = Math.floor(index / 12);
  const month = index % 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function nextMonth(value: string): string {
  return periodAt(monthIndex(value) + 1);
}

export function comparisonPeriod(spec: NlqQuerySpec): NlqQuerySpec['period'] | null {
  if (!spec.compare) return null;
  const width = monthIndex(spec.period.to) - monthIndex(spec.period.from) + 1;
  const offset = spec.compare === 'prev_year' ? 12 : width;
  return {
    from: periodAt(monthIndex(spec.period.from) - offset),
    to: periodAt(monthIndex(spec.period.to) - offset),
  };
}

export function normalizeSpec(input: unknown, model: NlqModel = getPublishedNlqModel()): NlqQuerySpec {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new NlqSpecError('查询请求必须是对象');
  }
  const raw = input as Record<string, unknown>;
  const extra = Object.keys(raw).filter(key => !SPEC_KEYS.has(key));
  if (extra.length) throw new NlqSpecError(`不支持的查询字段：${extra.join('、')}`);
  if (typeof raw.metric !== 'string' || !Object.hasOwn(model.metrics, raw.metric)) {
    throw new NlqSpecError('请选择已定义的指标');
  }
  const metric = raw.metric as NlqMetric;
  const metricDef = model.metrics[metric];
  const table = model.tables[metricDef.table];
  if (!table) throw new NlqSpecError('指标所用的数据表没有配置');
  const dimensions = availableDimensions(model, metricDef.table);
  const period = raw.period as Record<string, unknown> | undefined;
  if (!period || typeof period.from !== 'string' || typeof period.to !== 'string'
    || !PERIOD_RE.test(period.from) || !PERIOD_RE.test(period.to)
    || monthIndex(period.from) > monthIndex(period.to)) {
    throw new NlqSpecError('请提供有效的起止月份，格式为 yyyy-MM');
  }
  if (monthIndex(period.to) - monthIndex(period.from) > 35) {
    throw new NlqSpecError('一次最多查询 36 个月');
  }
  const groupBy = raw.group_by ?? [];
  if (!Array.isArray(groupBy) || groupBy.length > 3 || new Set(groupBy).size !== groupBy.length
    || groupBy.some(dim => typeof dim !== 'string' || !Object.hasOwn(dimensions, dim))) {
    throw new NlqSpecError('分组维度不属于当前指标');
  }
  const filters = raw.filters ?? {};
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new NlqSpecError('筛选条件格式不正确');
  }
  for (const [dim, values] of Object.entries(filters)) {
    if (!Object.hasOwn(dimensions, dim) || !Array.isArray(values) || values.length === 0
      || values.length > 20 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 255)) {
      throw new NlqSpecError(`筛选条件 ${dim} 不适用于当前指标`);
    }
  }
  const compare = raw.compare as NlqQuerySpec['compare'];
  if (compare !== undefined && compare !== 'prev_year' && compare !== 'prev_period') {
    throw new NlqSpecError('只支持同比或环比');
  }
  const limit = raw.limit ?? 50;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 100) {
    throw new NlqSpecError('最多返回 100 行');
  }
  return {
    ...(typeof raw.question === 'string' ? { question: raw.question.slice(0, 2000) } : {}),
    metric,
    period: { from: period.from, to: period.to },
    group_by: groupBy as NlqDimension[],
    filters: filters as NlqQuerySpec['filters'],
    ...(compare ? { compare } : {}),
    limit: limit as number,
    with_total: raw.with_total === true || raw.share === true,
    ...(raw.share === true ? { share: true } : {}),
  };
}

export function metricDefinition(metric: NlqMetric, model: NlqModel = getPublishedNlqModel()): NlqModel['metrics'][string] {
  return model.metrics[metric];
}

export function catalog(model: NlqModel = getPublishedNlqModel()): {
  name: string;
  metrics: Record<string, { label: string; unit: string; type: string; dimensions: string[]; notes: string[] }>;
  dimensions: NlqModel['dimensions'];
} {
  return {
    name: model.name,
    metrics: Object.fromEntries(Object.entries(model.metrics).map(([key, value]) => [key, {
      label: value.label,
      unit: value.unit,
      type: value.type,
      dimensions: Object.keys(availableDimensions(model, value.table)),
      notes: value.notes,
    }])),
    dimensions: model.dimensions,
  };
}

export function compileQuery(spec: NlqQuerySpec, options: {
  period?: NlqQuerySpec['period'];
  groupBy?: NlqDimension[];
  limit?: number;
} = {}, model: NlqModel = getPublishedNlqModel()): SqlStatement {
  const metric = model.metrics[spec.metric];
  const table = model.tables[metric.table];
  const groupBy = options.groupBy ?? spec.group_by ?? [];
  const period = options.period ?? spec.period;
  const limit = options.limit ?? spec.limit ?? 50;
  const sources = availableDimensions(model, metric.table);
  const usedDimensions = [...groupBy, ...Object.keys(spec.filters ?? {})];
  const joins = [...new Set(usedDimensions.map(dim => sources[dim]?.relation).filter((id): id is string => Boolean(id)))];
  const baseAlias = joins.length ? '[t0].' : '';
  const qualified = (column: string, relation?: string): string => {
    if (!relation) return `${baseAlias}${quotedIdentifier(column)}`;
    return `[j${joins.indexOf(relation)}].${quotedIdentifier(column)}`;
  };
  const dimensions = groupBy.map(dim => `${qualified(sources[dim].column, sources[dim].relation)} AS ${quotedIdentifier(dim)}`);
  const value = metric.subtractColumn
    ? `${qualified(metric.column)} - ${qualified(metric.subtractColumn)}`
    : qualified(metric.column);
  const valueExpr = `SUM(CAST(${value} AS decimal(28, 4))) AS [value]`;
  const parameters: SqlStatement['parameters'] = {
    fromDate: `${period.from}-01`,
    toDate: `${nextMonth(period.to)}-01`,
  };
  const clauses: string[] = [];
  const dateColumn = quotedIdentifier(table.dateColumn!);
  const dated = qualified(table.dateColumn!);
  if (metric.type === 'snapshot') {
    clauses.push(`${dated} = (SELECT MAX(${dateColumn}) FROM ${quotedTable(table.name)} WHERE ${dateColumn} >= @fromDate AND ${dateColumn} < @toDate)`);
  } else {
    clauses.push(`${dated} >= @fromDate AND ${dated} < @toDate`);
  }
  for (const [dim, values] of Object.entries(spec.filters ?? {})) {
    const column = qualified(sources[dim].column, sources[dim].relation);
    const names = (values ?? []).map((item, index) => {
      const name = `f_${dim}_${index}`;
      parameters[name] = item;
      return `@${name}`;
    });
    clauses.push(`${column} IN (${names.join(', ')})`);
  }
  const groupColumns = groupBy.map(dim => qualified(sources[dim].column, sources[dim].relation));
  const select = `SELECT TOP (${limit}) ${[...dimensions, valueExpr, `MAX(${dated}) AS [data_as_of]`].join(', ')}`;
  const group = groupColumns.length ? ` GROUP BY ${groupColumns.join(', ')}` : '';
  const from = `${quotedTable(table.name)}${joins.length ? ' AS [t0]' : ''}`;
  const joinSql = joins.map((id, index) => {
    const relation = model.relations[id];
    return ` LEFT JOIN ${quotedTable(model.tables[relation.toTable].name)} AS [j${index}] ON [t0].${quotedIdentifier(relation.fromColumn)} = [j${index}].${quotedIdentifier(relation.toColumn)}`;
  }).join('');
  return {
    text: `${select} FROM ${from}${joinSql} WHERE ${clauses.join(' AND ')}${group} ORDER BY [value] DESC`,
    parameters,
  };
}

export function compileMembers(dimension: NlqDimension, keyword = '', model: NlqModel = getPublishedNlqModel()): SqlStatement[] {
  if (!Object.hasOwn(model.dimensions, dimension)) throw new NlqSpecError('未知维度');
  const statements: SqlStatement[] = [];
  for (const table of Object.values(model.tables)) {
    const column = table.dimensions[dimension];
    if (!column) continue;
    const quoted = quotedIdentifier(column);
    statements.push({
      text: `SELECT TOP (30) ${quoted} AS [value], COUNT_BIG(*) AS [rows] FROM ${quotedTable(table.name)} WHERE ${quoted} IS NOT NULL AND CHARINDEX(@keyword, ${quoted}) > 0 GROUP BY ${quoted} ORDER BY [rows] DESC`,
      parameters: { keyword },
    });
  }
  return statements;
}
