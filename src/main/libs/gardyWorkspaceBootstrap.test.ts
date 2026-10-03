import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test } from 'vitest';

import { removeStockGardyBootstrap } from './gardyWorkspaceBootstrap';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('removes only an unchanged bundled bootstrap file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gardy-bootstrap-'));
  directories.push(directory);
  const bootstrapPath = path.join(directory, 'BOOTSTRAP.md');
  const stockText = '# BOOTSTRAP.md\nBundled first-run instructions\n';
  const stockHash = createHash('sha256').update(stockText).digest('hex');
  const stockHashes = new Set([stockHash]);

  fs.writeFileSync(bootstrapPath, stockText);
  expect(removeStockGardyBootstrap(directory, stockHashes)).toBe(true);
  expect(fs.existsSync(bootstrapPath)).toBe(false);

  fs.writeFileSync(bootstrapPath, `${stockText}Employee note\n`);
  expect(removeStockGardyBootstrap(directory, stockHashes)).toBe(false);
  expect(fs.readFileSync(bootstrapPath, 'utf8')).toContain('Employee note');
});

test('does nothing when the bootstrap file is absent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gardy-bootstrap-'));
  directories.push(directory);
  expect(removeStockGardyBootstrap(directory)).toBe(false);
});
