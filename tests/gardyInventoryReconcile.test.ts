import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const script = path.join(process.cwd(), 'SKILLs', 'gardy-inventory', 'scripts', 'reconcile.py');
const python = ['python3', 'python'].find(command => {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return result.status === 0;
});

const run = (args: string[]) => spawnSync(python!, [script, ...args], { encoding: 'utf8' });

describe('GARDY inventory reconciliation', () => {
  test.skipIf(!python)('preserves unmatched records and counts duplicates without changing source files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gardy-inventory-test-'));
    try {
      const ledger = path.join(dir, 'ledger.csv');
      const count = path.join(dir, 'count.csv');
      const output = path.join(dir, 'difference.csv');
      const ledgerSource = [
        '零件号,批次,仓库,库存数量',
        '00123,A,W1,10',
        'B-2,B,W1,7',
        'B-2,B,W1,7',
        'C-3,C,W1,5',
      ].join('\n');
      fs.writeFileSync(ledger, ledgerSource);
      fs.writeFileSync(count, [
        '零件号,批次,仓库,盘点数量',
        '00123,A,W1,8',
        'B-2,B,W1,14',
        'D-4,D,W1,4',
      ].join('\n'));

      const result = run([
        '--ledger', ledger, '--count', count, '--keys', '零件号,批次,仓库',
        '--ledger-quantity', '库存数量', '--count-quantity', '盘点数量',
        '--output', output,
      ]);
      expect(result.status, result.stderr).toBe(0);
      const summary = JSON.parse(result.stdout) as Record<string, string | number>;
      expect(summary['账面合计']).toBe('29');
      expect(summary['盘点合计']).toBe('26');
      expect(summary['总差异_盘点减账面']).toBe('-3');
      expect(summary['完全重复组数']).toBe(1);

      const rows = fs.readFileSync(output, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
      expect(rows).toContain('C-3,C,W1,5,,-5,盘点无对应记录,差异计算以零占位；不代表确认零库存，需人工核对,1,0');
      expect(rows).toContain('D-4,D,W1,,4,4,账面无对应记录,差异计算以零占位；不代表确认零库存，需人工核对,0,1');
      expect(fs.readFileSync(ledger, 'utf8')).toBe(ledgerSource);
      expect(fs.readFileSync(path.join(dir, 'difference_完全重复行.csv'), 'utf8')).toContain('B-2');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(!python)('fails before writing a report when a required quantity is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gardy-inventory-test-'));
    try {
      const ledger = path.join(dir, 'ledger.csv');
      const count = path.join(dir, 'count.csv');
      const output = path.join(dir, 'difference.csv');
      fs.writeFileSync(ledger, '零件号,库存数量\n00123,\n');
      fs.writeFileSync(count, '零件号,盘点数量\n00123,8\n');
      const result = run([
        '--ledger', ledger, '--count', count, '--keys', '零件号',
        '--ledger-quantity', '库存数量', '--count-quantity', '盘点数量',
        '--output', output,
      ]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('数量为空');
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
