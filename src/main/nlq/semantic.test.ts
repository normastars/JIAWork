import { describe, expect, test } from 'vitest';

import rawModel from './model.json';
import { validateNlqModel, validateNlqPhysicalSchema } from './modelValidation';
import { catalog, compileQuery, NlqSpecError, normalizeSpec } from './semantic';

const model = validateNlqModel(rawModel);
const period = { from: '2026-10', to: '2026-10' };

describe('CAC SQL Server semantic model', () => {
  test('uses the real CAC tables and removes unsupported demo metrics', () => {
    expect(model.tables.so_head.name).toBe('dbo.SO_HEAD1');
    expect(model.tables.stock_line.name).toBe('dbo.STOCK1');
    expect(model.metrics.inventory_quantity).toBeUndefined();
    expect(model.metrics.purchase_open_quantity).toBeUndefined();
    expect(catalog(model).metrics.stock_net_movement.requiredFilters).toEqual(['item_code']);
  });

  test('requires an item before adding quantities with mixed units', () => {
    expect(() => normalizeSpec({ metric: 'stock_net_movement', period }, model)).toThrow(NlqSpecError);
    const spec = normalizeSpec({ metric: 'stock_net_movement', period, filters: { item_code: ['13606400083'] } }, model);
    const query = compileQuery(spec, {}, model);
    expect(query.text).toContain('FROM [dbo].[STOCK1]');
    expect(query.text).toContain('[ITEM_CODE] IN (@f_item_code_0)');
    expect(query.parameters.f_item_code_0).toBe('13606400083');
    expect(() => normalizeSpec({ metric: 'purchase_order_quantity', period,
      filters: { item_code: ['13606300327'] } }, model)).toThrow(NlqSpecError);
  });

  test('compiles a real sales metric with bound customer and item filters', () => {
    const spec = normalizeSpec({ metric: 'sales_order_quantity', period,
      filters: { item_code: ['118101005'], customer: ["3850'; DROP TABLE dbo.SO_HEAD1;--"] } }, model);
    const query = compileQuery(spec, {}, model);
    expect(query.text).toContain('FROM [dbo].[CAC_SO_LINES]');
    expect(query.text).not.toContain('DROP TABLE');
    expect(query.parameters.f_customer_0).toContain('DROP TABLE');
  });

  test('counts orders and sums RMB purchases using source dates', () => {
    const orders = compileQuery(normalizeSpec({ metric: 'sales_order_count', period }, model), {}, model);
    const purchases = compileQuery(normalizeSpec({ metric: 'purchase_order_amount', period }, model), {}, model);
    expect(orders.text).toContain('[ROW_COUNT]');
    expect(orders.text).toContain('FROM [dbo].[CAC_SO_ORDERS]');
    expect(purchases.text).toContain('FROM [dbo].[PO_HEAD1]');
    expect(purchases.text).toContain('[TOTAL_AMT]');
  });

  test('rejects missing columns, unknown metrics, and invalid relationships', () => {
    expect(() => validateNlqPhysicalSchema(model, [{ name: 'dbo.SO_HEAD1', columns: [] }]))
      .toThrow('找不到字段');
    expect(() => normalizeSpec({ metric: 'inventory_quantity', period }, model)).toThrow(NlqSpecError);
    expect(() => validateNlqModel({ ...model, relations: {
      ...model.relations,
      invalid: { fromTable: 'so_line', toTable: 'so_head', fromColumn: 'INVOICE',
        toColumn: 'SO_NUMBER', cardinality: 'wrong' },
    } })).toThrow('基数无效');
  });
});
