import { afterAll, describe, expect, test } from 'vitest';

import { findNlqMembers, queryNlq } from './engine';
import rawModel from './model.json';
import { validateNlqModel, validateNlqPhysicalSchema } from './modelValidation';
import { describeResult } from './resultText';
import { comparisonPeriod, compileQuery, NlqSpecError, normalizeSpec } from './semantic';
import { closeSqlServerPool, inspectNlqSchema, validateNlqRelationKeys } from './sqlServerRunner';

const salesSpec = {
  metric: 'sales_order_quantity',
  period: { from: '2026-10', to: '2026-10' },
  filters: { customer: ['客户甲'] },
};

describe('SQL Server semantic model', () => {
  const joinedModel = validateNlqModel({
    ...rawModel,
    dimensions: { ...rawModel.dimensions, region: { label: '区域', aliases: [] } },
    tables: {
      ...rawModel.tables,
      customers: { name: 'dbo.CustomerMaster', dimensions: { region: 'region_name' } },
    },
    relations: {
      customer_lookup: {
        fromTable: 'sales_orders', toTable: 'customers',
        fromColumn: 'customer_name', toColumn: 'customer_name', cardinality: 'many_to_one',
      },
    },
  });

  test('joins an approved lookup table without accepting SQL from callers', () => {
    const spec = normalizeSpec({
      ...salesSpec, group_by: ['region'], filters: { region: ["华东'; DROP TABLE dbo.CustomerMaster;--"] },
    }, joinedModel);
    const statement = compileQuery(spec, {}, joinedModel);
    expect(statement.text).toContain('LEFT JOIN [dbo].[CustomerMaster] AS [j0]');
    expect(statement.text).toContain('[t0].[customer_name] = [j0].[customer_name]');
    expect(statement.text).toContain('[j0].[region_name] IN (@f_region_0)');
    expect(statement.text).not.toContain('DROP TABLE');
    expect(statement.parameters.f_region_0).toContain('DROP TABLE');
  });

  test('rejects missing columns and ambiguous relationships before publishing', () => {
    expect(() => validateNlqPhysicalSchema(joinedModel, [{ name: 'dbo.CustomerMaster', columns: [] }]))
      .toThrow('找不到表或视图');
    expect(() => validateNlqModel({
      ...joinedModel,
      relations: { ...joinedModel.relations, second: { ...joinedModel.relations.customer_lookup } },
    })).toThrow('来自多条关联');
    const oneToMany = validateNlqModel({
      ...joinedModel,
      relations: { customer_lookup: { ...joinedModel.relations.customer_lookup, cardinality: 'one_to_many' } },
    });
    expect(() => normalizeSpec({ ...salesSpec, group_by: ['region'] }, oneToMany)).toThrow(NlqSpecError);
  });
  test('compiles approved metrics and parameterizes member values', () => {
    const spec = normalizeSpec({
      ...salesSpec,
      filters: { customer: ["客户甲'; DROP TABLE dbo.SalesOrderLine;--"] },
    });
    const statement = compileQuery(spec);
    expect(statement.text).toContain('FROM [dbo].[SalesOrderLine]');
    expect(statement.text).toContain('@f_customer_0');
    expect(statement.text).not.toContain('DROP TABLE');
    expect(statement.parameters.f_customer_0).toContain('DROP TABLE');
  });

  test('rejects unknown metrics, invalid periods, and incompatible dimensions', () => {
    expect(() => normalizeSpec({ ...salesSpec, metric: 'raw_sql' })).toThrow(NlqSpecError);
    expect(() => normalizeSpec({ ...salesSpec, metric: 'toString' })).toThrow(NlqSpecError);
    expect(() => normalizeSpec({ ...salesSpec, period: { from: '2026-13', to: '2026-13' } })).toThrow(NlqSpecError);
    expect(() => normalizeSpec({ ...salesSpec, group_by: ['supplier'] })).toThrow(NlqSpecError);
  });

  test('selects one snapshot date within the requested period', () => {
    const statement = compileQuery(normalizeSpec({
      metric: 'inventory_quantity',
      period: { from: '2026-10', to: '2026-10' },
    }));
    expect(statement.text).toContain('MAX([snapshot_date])');
    expect(statement.text).toContain('[snapshot_date] >= @fromDate');
  });

  test('aligns the same month in the prior year', () => {
    const period = comparisonPeriod(normalizeSpec({ ...salesSpec, compare: 'prev_year' }));
    expect(period).toEqual({ from: '2025-10', to: '2025-10' });
  });

});

describe.skipIf(!process.env.JIAWORK_NLQ_SQLSERVER_PASSWORD)('SQL Server Docker fixture', () => {
  afterAll(async () => { await closeSqlServerPool(); });

  test('reads sales quantity and year-over-year result from real SQL Server', async () => {
    const result = await queryNlq({ ...salesSpec, compare: 'prev_year' });
    expect(result.total).toBe(180);
    expect(result.comparison).toEqual({ previous: 150, difference: 30, changePercent: 20 });
    expect(describeResult(result)).toContain('多 30 件，同比增长 20%');
    expect(result.dataAsOf).toBe('2026-10-15');
  });

  test('aggregates outstanding purchases by supplier', async () => {
    const result = await queryNlq({
      metric: 'purchase_open_quantity',
      period: { from: '2026-10', to: '2026-10' },
      group_by: ['supplier'],
      with_total: true,
    });
    expect(result.total).toBe(150);
    expect(result.rows.find(row => row.supplier === '供应商甲')?.value).toBe(150);
  });

  test('uses the latest inventory snapshot and finds real members', async () => {
    const result = await queryNlq({
      metric: 'inventory_quantity',
      period: { from: '2026-10', to: '2026-10' },
      filters: { warehouse: ['原料仓'], part_no: ['JD-001'] },
    });
    expect(result.total).toBe(120);
    expect(result.dataAsOf).toBe('2026-10-31');
    const members = await findNlqMembers('customer', '客户');
    expect(members.matches.map(item => item.value)).toContain('客户甲');
  });

  test('queries a newly configured lookup table and validates real schema', async () => {
    const joinedModel = validateNlqModel({
      ...rawModel,
      dimensions: { ...rawModel.dimensions, region: { label: '区域', aliases: [] } },
      tables: { ...rawModel.tables, customers: { name: 'dbo.CustomerMaster', dimensions: { region: 'region_name' } } },
      relations: { customer_lookup: { fromTable: 'sales_orders', toTable: 'customers',
        fromColumn: 'customer_name', toColumn: 'customer_name', cardinality: 'many_to_one' } },
    });
    validateNlqPhysicalSchema(joinedModel, await inspectNlqSchema());
    await validateNlqRelationKeys(joinedModel);
    const result = await queryNlq({
      metric: 'sales_order_quantity', period: { from: '2026-10', to: '2026-10' },
      group_by: ['region'],
    }, undefined, joinedModel);
    expect(result.rows.find(row => row.region === '华东')?.value).toBe(180);
    expect(result.rows.find(row => row.region === '华南')?.value).toBe(50);
  });
});
