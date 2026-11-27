import { appendFile, chmod } from 'node:fs/promises';
import path from 'node:path';

import { app } from 'electron';

export async function writeNlqAudit(entry: Record<string, unknown>): Promise<void> {
  try {
    const file = path.join(app.getPath('userData'), 'nlq-audit.jsonl');
    await appendFile(file, `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`, { encoding: 'utf8', mode: 0o600 });
    await chmod(file, 0o600);
  } catch (error) {
    console.warn('[NLQ] audit write failed:', error);
  }
}
