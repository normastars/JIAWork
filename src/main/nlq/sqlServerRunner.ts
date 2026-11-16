import sql from 'mssql';

import type { NlqDatabaseTable, NlqModel } from '../../shared/nlq/constants';
import type { SqlStatement } from './semantic';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function connectionConfig(): sql.config {
  const password = process.env.JIAWORK_NLQ_SQLSERVER_PASSWORD;
  if (!password) throw new Error('尚未配置查数数据库密码');
  const port = Number(process.env.JIAWORK_NLQ_SQLSERVER_PORT ?? '14333');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('查数数据库端口无效');
  return {
    server: process.env.JIAWORK_NLQ_SQLSERVER_HOST || '127.0.0.1',
    port,
    database: process.env.JIAWORK_NLQ_SQLSERVER_DATABASE || 'JIAWorkNLQDemo',
    user: process.env.JIAWORK_NLQ_SQLSERVER_USER || 'nlq_demo_reader',
    password,
    options: {
      encrypt: process.env.JIAWORK_NLQ_SQLSERVER_ENCRYPT === 'true',
      trustServerCertificate: process.env.JIAWORK_NLQ_SQLSERVER_TRUST_CERT !== 'false',
    },
    pool: { min: 0, max: 2, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(connectionConfig());
    poolPromise = pool.connect().catch(error => {
      poolPromise = null;
      console.error('[NLQ] SQL Server connection failed:', error);
      throw new Error('无法连接查数数据库');
    });
  }
  return poolPromise;
}

export async function runSelect(statement: SqlStatement): Promise<Array<Record<string, unknown>>> {
  if (!/^\s*SELECT\s/i.test(statement.text) || statement.text.includes(';')) {
    throw new Error('查数模块只允许单条 SELECT');
  }
  const pool = await getPool();
  const request = pool.request();
  for (const [name, value] of Object.entries(statement.parameters)) {
    if (name === 'fromDate' || name === 'toDate') {
      request.input(name, sql.Date, new Date(`${value}T00:00:00Z`));
    } else if (typeof value === 'number') {
      request.input(name, sql.Int, value);
    } else {
      request.input(name, sql.NVarChar(255), value);
    }
  }
  try {
    const result = await request.query<Record<string, unknown>>(statement.text);
    return result.recordset;
  } catch (error) {
    console.error('[NLQ] SQL Server SELECT failed:', error);
    throw new Error('数据库查询失败，请检查查数数据库和语义模型');
  }
}

export async function inspectNlqSchema(): Promise<NlqDatabaseTable[]> {
  const rows = await runSelect({
    text: `SELECT TABLE_SCHEMA AS [schema_name], TABLE_NAME AS [table_name],
      COLUMN_NAME AS [column_name], DATA_TYPE AS [data_type]
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`,
    parameters: {},
  });
  const tables = new Map<string, NlqDatabaseTable>();
  for (const row of rows) {
    const name = `${String(row.schema_name)}.${String(row.table_name)}`;
    if (!tables.has(name)) tables.set(name, { name, columns: [] });
    tables.get(name)!.columns.push({ name: String(row.column_name), dataType: String(row.data_type) });
  }
  return [...tables.values()];
}

export async function validateNlqRelationKeys(model: NlqModel): Promise<void> {
  for (const [id, relation] of Object.entries(model.relations)) {
    if (relation.cardinality === 'one_to_many') continue;
    const sides = [{ table: relation.toTable, column: relation.toColumn, label: '目标' }];
    if (relation.cardinality === 'one_to_one') {
      sides.push({ table: relation.fromTable, column: relation.fromColumn, label: '来源' });
    }
    for (const side of sides) {
      const table = model.tables[side.table].name.split('.').map(part => `[${part}]`).join('.');
      const column = `[${side.column}]`;
      const rows = await runSelect({
        text: `SELECT TOP (1) ${column} AS [duplicate_key] FROM ${table} WHERE ${column} IS NOT NULL GROUP BY ${column} HAVING COUNT_BIG(*) > 1`,
        parameters: {},
      });
      if (rows.length) throw new Error(`关联 ${id} 的${side.label}字段存在重复值，请调整关系类型`);
    }
  }
}

export async function sqlServerStatus(): Promise<{ connected: boolean; database: string; message: string }> {
  const database = process.env.JIAWORK_NLQ_SQLSERVER_DATABASE || 'JIAWorkNLQDemo';
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    return { connected: true, database, message: 'SQL Server 查数数据库已连接' };
  } catch (error) {
    return {
      connected: false,
      database,
      message: error instanceof Error ? error.message : 'SQL Server 查数数据库连接失败',
    };
  }
}

export async function closeSqlServerPool(): Promise<void> {
  const current = poolPromise;
  poolPromise = null;
  if (current) await (await current).close();
}
