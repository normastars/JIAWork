import type { NlqDatabaseTable, NlqModel } from '../../shared/nlq/constants';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function label(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error(`${name}不能为空或超过 200 字`);
}

function identifier(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new Error(`${name}只能包含英文字母、数字和下划线，且不能以数字开头`);
}

function entries(value: unknown, name: string, max: number): Array<[string, unknown]> {
  if (!record(value)) throw new Error(`${name}格式不正确`);
  const result = Object.entries(value);
  if (result.length > max) throw new Error(`${name}数量超过上限 ${max}`);
  for (const [key] of result) identifier(key, `${name} ID`);
  return result;
}

/** Validate untrusted renderer/disk input before it can affect SQL compilation. */
export function validateNlqModel(input: unknown): NlqModel {
  if (!record(input)) throw new Error('查数模型格式不正确');
  const model = input as unknown as NlqModel;
  if (!Number.isSafeInteger(model.version) || model.version < 1) throw new Error('模型版本无效');
  label(model.name, '模型名称');
  const dimensions = entries(model.dimensions, '维度', 50);
  const tables = entries(model.tables, '数据表', 50);
  const relations = entries(model.relations ?? {}, '关联关系', 100);
  const metrics = entries(model.metrics, '指标', 100);
  if (!tables.length || !metrics.length) throw new Error('至少配置一张表和一个指标');
  for (const [key, value] of dimensions) {
    if (!record(value)) throw new Error(`维度 ${key} 格式不正确`);
    label(value.label, `维度 ${key} 名称`);
    if (!Array.isArray(value.aliases) || value.aliases.length > 20
      || value.aliases.some(alias => typeof alias !== 'string' || alias.length > 100)) {
      throw new Error(`维度 ${key} 别名格式不正确`);
    }
  }
  for (const [key, value] of tables) {
    if (!record(value) || typeof value.name !== 'string' || !TABLE_NAME.test(value.name)) {
      throw new Error(`表 ${key} 必须使用 schema.table 格式`);
    }
    if (value.dateColumn !== undefined) identifier(value.dateColumn, `表 ${key} 日期字段`);
    for (const [dimension, column] of entries(value.dimensions, `表 ${key} 的维度`, 50)) {
      if (!Object.hasOwn(model.dimensions, dimension)) throw new Error(`表 ${key} 引用了未知维度 ${dimension}`);
      identifier(column, `表 ${key} 的维度字段`);
    }
  }
  for (const [key, value] of relations) {
    if (!record(value)) throw new Error(`关联 ${key} 格式不正确`);
    if (typeof value.fromTable !== 'string' || !Object.hasOwn(model.tables, value.fromTable)
      || typeof value.toTable !== 'string' || !Object.hasOwn(model.tables, value.toTable)
      || value.fromTable === value.toTable) throw new Error(`关联 ${key} 的数据表无效`);
    identifier(value.fromColumn, `关联 ${key} 来源字段`);
    identifier(value.toColumn, `关联 ${key} 目标字段`);
    if (!['many_to_one', 'one_to_one', 'one_to_many'].includes(String(value.cardinality))) {
      throw new Error(`关联 ${key} 的基数无效`);
    }
  }
  for (const [key, value] of metrics) {
    if (!record(value)) throw new Error(`指标 ${key} 格式不正确`);
    label(value.label, `指标 ${key} 名称`);
    label(value.unit, `指标 ${key} 单位`);
    if (typeof value.table !== 'string' || !Object.hasOwn(model.tables, value.table)
      || !model.tables[value.table].dateColumn) throw new Error(`指标 ${key} 的基础表或日期字段无效`);
    identifier(value.column, `指标 ${key} 数值字段`);
    if (value.subtractColumn !== undefined) identifier(value.subtractColumn, `指标 ${key} 扣减字段`);
    if (value.type !== 'flow' && value.type !== 'snapshot') throw new Error(`指标 ${key} 类型无效`);
    if (!Array.isArray(value.notes) || value.notes.length > 10
      || value.notes.some(note => typeof note !== 'string' || note.length > 500)) {
      throw new Error(`指标 ${key} 口径说明格式不正确`);
    }
  }
  for (const [metricId, metric] of Object.entries(model.metrics)) {
    const base = model.tables[metric.table];
    const seen = new Set(Object.keys(base.dimensions));
    for (const relation of Object.values(model.relations ?? {})) {
      if (relation.fromTable !== metric.table || relation.cardinality === 'one_to_many') continue;
      for (const dimension of Object.keys(model.tables[relation.toTable].dimensions)) {
        if (Object.hasOwn(base.dimensions, dimension)) continue;
        if (seen.has(dimension)) throw new Error(`指标 ${metricId} 的维度 ${dimension} 来自多条关联，请调整模型`);
        seen.add(dimension);
      }
    }
  }
  return structuredClone({ ...model, relations: model.relations ?? {} });
}

export function validateNlqPhysicalSchema(model: NlqModel, schema: NlqDatabaseTable[]): void {
  const physical = new Map(schema.map(table => [table.name.toLowerCase(), new Map(
    table.columns.map(column => [column.name.toLowerCase(), column.dataType.toLowerCase()]),
  )]));
  for (const [id, table] of Object.entries(model.tables)) {
    const columns = physical.get(table.name.toLowerCase());
    if (!columns) throw new Error(`数据库中找不到表或视图 ${table.name}`);
    const required = [table.dateColumn, ...Object.values(table.dimensions),
      ...Object.values(model.metrics).filter(metric => metric.table === id)
        .flatMap(metric => [metric.column, metric.subtractColumn]),
      ...Object.values(model.relations).flatMap(relation => [
        relation.fromTable === id ? relation.fromColumn : undefined,
        relation.toTable === id ? relation.toColumn : undefined,
      ])].filter((column): column is string => Boolean(column));
    for (const column of required) if (!columns.has(column.toLowerCase())) {
      throw new Error(`${table.name} 中找不到字段 ${column}`);
    }
    if (table.dateColumn && !/^(date|datetime|datetime2|smalldatetime|datetimeoffset)$/.test(columns.get(table.dateColumn.toLowerCase()) ?? '')) {
      throw new Error(`${table.name}.${table.dateColumn} 不是日期类型`);
    }
    for (const metric of Object.values(model.metrics).filter(item => item.table === id)) {
      for (const column of [metric.column, metric.subtractColumn].filter((item): item is string => Boolean(item))) {
        if (!/^(bigint|int|smallint|tinyint|decimal|numeric|money|smallmoney|float|real)$/.test(columns.get(column.toLowerCase()) ?? '')) {
          throw new Error(`${table.name}.${column} 不是数值类型`);
        }
      }
    }
  }
}
