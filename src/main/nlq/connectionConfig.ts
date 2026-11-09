import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

const connectionKeys = {
  host: 'JIAWORK_NLQ_SQLSERVER_HOST',
  port: 'JIAWORK_NLQ_SQLSERVER_PORT',
  database: 'JIAWORK_NLQ_SQLSERVER_DATABASE',
  user: 'JIAWORK_NLQ_SQLSERVER_USER',
  password: 'JIAWORK_NLQ_SQLSERVER_PASSWORD',
  encrypt: 'JIAWORK_NLQ_SQLSERVER_ENCRYPT',
  trustServerCertificate: 'JIAWORK_NLQ_SQLSERVER_TRUST_CERT',
} as const;

/** Load deployment-owned connection settings before the query service starts. */
export function loadNlqConnectionConfig(): boolean {
  if (process.env.JIAWORK_NLQ_SQLSERVER_PASSWORD) return true;
  const file = path.join(app.getPath('userData'), 'nlq-connection.json');
  if (!fs.existsSync(file)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (typeof config.password !== 'string' || !config.password) throw new Error('password is missing');
    for (const [field, envName] of Object.entries(connectionKeys)) {
      const value = config[field];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        process.env[envName] = String(value);
      }
    }
    console.log('[NLQ] deployment connection configuration loaded');
    return true;
  } catch (error) {
    console.error('[NLQ] invalid deployment connection configuration:', error);
    return false;
  }
}
