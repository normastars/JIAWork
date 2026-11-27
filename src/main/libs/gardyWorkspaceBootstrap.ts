import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// The plain BOOTSTRAP.md written by the pinned OpenClaw runtime. Remove only
// this untouched template; employees may have their own workspace instructions.
const STOCK_BOOTSTRAP_HASHES: ReadonlySet<string> = new Set([
  'bd4a143499ab626d4c8b664086c3fcdfe32e8d1df77d2dea757059015fd558c0',
]);

export function removeStockGardyBootstrap(
  workspacePath: string,
  stockHashes: ReadonlySet<string> = STOCK_BOOTSTRAP_HASHES,
): boolean {
  const bootstrapPath = path.join(workspacePath, 'BOOTSTRAP.md');
  let content: Buffer;
  try {
    if (!fs.lstatSync(bootstrapPath).isFile()) return false;
    content = fs.readFileSync(bootstrapPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }

  const hash = createHash('sha256').update(content).digest('hex');
  if (!stockHashes.has(hash)) return false;
  fs.unlinkSync(bootstrapPath);
  return true;
}
