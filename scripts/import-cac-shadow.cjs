#!/usr/bin/env node
// Import CAC exports into an isolated local SQL Server shadow database.
// Source CSV files stay outside the repository and are never copied into app resources.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sql = require('mssql');
const legacyDecoder = new TextDecoder('gb18030', { fatal: true });

const sourceDir = path.resolve(process.argv.slice(2).find(value => value !== '--check') || path.join(os.homedir(), 'Desktop', 'sql_res'));
const checkOnly = process.argv.includes('--check');
const root = path.resolve(__dirname, '..');
const workDir = path.join(root, '.work');
const secretFile = path.join(workDir, 'cac-shadow-app.env');
const database = 'JIAWorkCACShadow';
const readerUser = 'nlq_cac_reader';
const container = process.env.JIAWORK_CAC_SQLSERVER_CONTAINER || 'jiawork-cac-shadow';
const image = 'mcr.microsoft.com/mssql/server:2022-latest';

const columns = {
  SO_HEAD1: [['SO_NUMBER', 'text'], ['TRX_TYPE', 'text'], ['YOUR_REF', 'text'], ['INDATE', 'date'], ['CUSTOMER', 'text'], ['PAY_TERM', 'text'], ['CURRENCY', 'text'], ['EXCH_RATE', 'number'], ['TOTAL_AMT', 'number']],
  SO_LN1: [['INVOICE', 'text'], ['SOLINE', 'number'], ['SHIP_DATE', 'date'], ['ITEM_CODE', 'text'], ['DESC0', 'description'], ['TOTALPRC_T', 'number'], ['CRRNCY', 'text'], ['SHW_QTY', 'number'], ['SHW_UNIT', 'text'], ['SHW_UPRICE', 'number']],
  PO_HEAD1: [['PO_NUMBER', 'text'], ['TRX_TYPE', 'text'], ['INDATE', 'date'], ['SUPPLIER', 'text'], ['PAY_TERM', 'text'], ['CURRENCY', 'text'], ['EXCH_RATE', 'number'], ['TOTAL_AMT', 'number']],
  PO_LN1: [['INVOICE', 'text'], ['SHIP_DATE', 'date'], ['ITEM_CODE', 'text'], ['DESC0', 'description'], ['TOTALPRC_T', 'number'], ['CRRNCY', 'text'], ['SHW_QTY', 'number'], ['SHW_UNIT', 'text'], ['SHW_UPRICE', 'number']],
  MRL_HD1: [['MRL_CODE', 'text'], ['PRODUCT', 'text'], ['DESC0', 'description'], ['SO_NUMBER', 'text'], ['SOLINE', 'number'], ['LOCATION', 'text'], ['SHW_QTY', 'number'], ['SHW_UNIT', 'text'], ['DATE_FINSH', 'date']],
  MRLIST1: [['MRL_CODE', 'text'], ['ITEM_CODE', 'text'], ['LOCATION', 'text'], ['REQ_QTY', 'number'], ['ISSUED', 'number'], ['P_LOSS', 'number']],
  MO_BOM: [['MRL_CODE', 'text'], ['PARENT', 'text'], ['ITEM_CODE', 'text'], ['SEQ', 'number'], ['SHW_QTY', 'number'], ['P_LOSS', 'number'], ['BOM_UNIT', 'text']],
  STOCK1: [['TRX_CODE', 'text'], ['TRX_TYPE', 'text'], ['INDATE', 'date'], ['ITEM_CODE', 'text'], ['LOCATION', 'text'], ['QUANTITY', 'number'], ['TOTALAMT', 'number'], ['REF_CODE', 'text']],
};

const files = [
  ['SO_HEAD1', '销售合同主表.csv'],
  ['SO_LN1', '销售订单明细_2026.csv', /^(?:OA|OD)[0-9]{5},[0-9]+,(?:\d{4}-\d{2}-\d{2} 00:00:00\.000|NULL),[^,]+,/, 4, 5],
  ['PO_HEAD1', '采购订单主表_2026.csv'],
  ['PO_LN1', '采购订单明细_2026.csv', /^[A-Z0-9]+,(?:\d{4}-\d{2}-\d{2} 00:00:00\.000|NULL),[^,]+,/, 3, 5],
  ['MRL_HD1', '生产单产品_2026.csv', /^SO[0-9]+,[^,]+,/, 2, 6],
  ['MRLIST1', '生产单物料_2026.csv'],
  ['MO_BOM', '生产单BOM_2026.csv'],
  ['STOCK1', '出入库明细_2026.csv'],
];

function readRows(table, name, startPattern, left, right) {
  const file = path.join(sourceDir, name);
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const chunks = [];
  for (const line of lines) {
    if (startPattern && startPattern.test(line)) chunks.push(line);
    else if (startPattern && chunks.length) chunks[chunks.length - 1] += `\n${line}`;
    else if (startPattern) throw new Error(`${name}: data before the first record`);
    else chunks.push(line);
  }
  const count = columns[table].length;
  const rows = chunks.map((chunk, index) => {
    const parts = chunk.split(',');
    const row = startPattern ? [...parts.slice(0, left), parts.slice(left, -right).join(','), ...parts.slice(-right)] : parts;
    if (row.length !== count) throw new Error(`${name}: record ${index + 1} has ${row.length} fields; expected ${count}`);
    return row.map((value, field) => parseValue(value, columns[table][field][1], name, index + 1));
  });
  return rows;
}

function parseValue(value, type, file, row) {
  if (value === '' || value === 'NULL') return null;
  if (type === 'number') {
    if (!/^-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(value)) throw new Error(`${file}: record ${row} has an invalid number`);
    return Number(value);
  }
  if (type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2} 00:00:00\.000$/.test(value)) throw new Error(`${file}: record ${row} has an invalid date`);
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
  if (/[\u00C0-\u00FF]/.test(value) && [...value].every(char => char.codePointAt(0) <= 255)) {
    try { value = legacyDecoder.decode(Buffer.from(value, 'latin1')); }
    catch { /* Preserve the original export text when it is not valid GB18030. */ }
  }
  return value;
}

function sqlType(type) {
  if (type === 'number') return sql.Decimal(28, 6);
  if (type === 'date') return sql.DateTime2(3);
  return sql.NVarChar(type === 'description' ? 1000 : 100);
}

function adminPassword() {
  const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
  const entry = info.Config.Env.find(item => item.startsWith('MSSQL_SA_PASSWORD='));
  if (!entry) throw new Error('SQL Server container has no admin password');
  return entry.slice('MSSQL_SA_PASSWORD='.length);
}

function ensureContainer() {
  let info;
  try { info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', stdio: 'pipe' }))[0]; }
  catch { info = null; }
  if (!info) {
    fs.mkdirSync(workDir, { recursive: true });
    const envFile = path.join(workDir, 'cac-shadow-container.env');
    if (!fs.existsSync(envFile)) {
      writeSecret(envFile, `ACCEPT_EULA=Y\nMSSQL_PID=Developer\nMSSQL_SA_PASSWORD=Jw!${crypto.randomBytes(24).toString('base64url')}\n`);
    }
    execFileSync('docker', ['run', '--platform', 'linux/amd64', '--name', container,
      '--env-file', envFile, '-p', '127.0.0.1:14333:1433',
      '-v', `${container}:/var/opt/mssql`, '--restart', 'unless-stopped', '-d', image], { stdio: 'pipe' });
  } else if (!info.State.Running) {
    execFileSync('docker', ['start', container], { stdio: 'pipe' });
  }
}

function readerPassword() {
  fs.mkdirSync(workDir, { recursive: true });
  if (fs.existsSync(secretFile)) {
    const entry = fs.readFileSync(secretFile, 'utf8').split('\n').find(line => line.startsWith('JIAWORK_NLQ_SQLSERVER_PASSWORD='));
    if (entry) return entry.split('=').slice(1).join('=');
  }
  return `Jw!${crypto.randomBytes(24).toString('base64url')}`;
}

function writeSecret(file, contents) {
  fs.writeFileSync(file, contents, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

async function createSchema(pool) {
  for (const [table, fields] of Object.entries(columns)) {
    const definition = fields.map(([name, type]) => `[${name}] ${type === 'date' ? 'datetime2(3)' : type === 'number' ? 'decimal(28,6)' : type === 'description' ? 'nvarchar(1000)' : 'nvarchar(100)'} NULL`).join(', ');
    await pool.request().query(`IF OBJECT_ID(N'dbo.${table}', N'U') IS NULL CREATE TABLE dbo.[${table}] (${definition})`);
  }
}

async function createViews(pool) {
  const views = {
    CAC_SO_ORDERS: `SELECT SO_NUMBER, TRX_TYPE, INDATE, CUSTOMER, CAST(1 AS int) AS ROW_COUNT FROM dbo.SO_HEAD1`,
    CAC_SO_LINES: `SELECT l.INVOICE, l.SOLINE, h.INDATE, h.CUSTOMER, h.TRX_TYPE, l.ITEM_CODE, l.SHW_QTY, l.SHW_UNIT FROM dbo.SO_LN1 l JOIN dbo.SO_HEAD1 h ON h.SO_NUMBER = l.INVOICE`,
    CAC_PO_ORDERS: `SELECT PO_NUMBER, TRX_TYPE, INDATE, SUPPLIER, CAST(1 AS int) AS ROW_COUNT FROM dbo.PO_HEAD1`,
    CAC_PO_LINES: `SELECT l.INVOICE, h.INDATE, h.SUPPLIER, h.TRX_TYPE, l.ITEM_CODE, l.SHW_QTY, l.SHW_UNIT, l.TOTALPRC_T FROM dbo.PO_LN1 l JOIN dbo.PO_HEAD1 h ON h.PO_NUMBER = l.INVOICE`,
    CAC_MATERIAL_DATED: `SELECT m.MRL_CODE, d.DATE_FINSH, m.ITEM_CODE, m.LOCATION, m.REQ_QTY, m.ISSUED, m.P_LOSS FROM dbo.MRLIST1 m JOIN (SELECT MRL_CODE, MIN(DATE_FINSH) AS DATE_FINSH FROM dbo.MRL_HD1 GROUP BY MRL_CODE) d ON d.MRL_CODE = m.MRL_CODE`,
    CAC_BOM_DATED: `SELECT b.MRL_CODE, d.DATE_FINSH, b.PARENT, b.ITEM_CODE, b.BOM_UNIT, CAST(1 AS int) AS ROW_COUNT FROM dbo.MO_BOM b JOIN (SELECT MRL_CODE, MIN(DATE_FINSH) AS DATE_FINSH FROM dbo.MRL_HD1 GROUP BY MRL_CODE) d ON d.MRL_CODE = b.MRL_CODE`,
  };
  for (const [name, body] of Object.entries(views)) {
    await pool.request().query(`CREATE OR ALTER VIEW dbo.[${name}] AS ${body}`);
  }
}

async function provisionReader(master, pool, password) {
  await master.request().input('password', sql.NVarChar(100), password).query(`
    DECLARE @statement nvarchar(max);
    IF SUSER_ID(N'${readerUser}') IS NULL
      SET @statement = N'CREATE LOGIN [${readerUser}] WITH PASSWORD = ''' + REPLACE(@password, '''', '''''') + N''', CHECK_POLICY = ON';
    ELSE
      SET @statement = N'ALTER LOGIN [${readerUser}] WITH PASSWORD = ''' + REPLACE(@password, '''', '''''') + N'''';
    EXEC(@statement)`);
  await pool.request().query(`IF USER_ID(N'${readerUser}') IS NULL CREATE USER [${readerUser}] FOR LOGIN [${readerUser}]`);
  await pool.request().query(`IF IS_ROLEMEMBER(N'db_datareader', N'${readerUser}') = 0 ALTER ROLE [db_datareader] ADD MEMBER [${readerUser}]`);
}

function desktopUserDataDir() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'LobsterAI');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'LobsterAI');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'LobsterAI');
}

function provisionDesktop(password) {
  const settings = { host: '127.0.0.1', port: 14333, database, user: readerUser, password };
  const file = path.join(desktopUserDataDir(), 'nlq-connection.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !fs.existsSync(`${file}.pre-cac`)) fs.copyFileSync(file, `${file}.pre-cac`);
  writeSecret(file, JSON.stringify(settings));
  writeSecret(secretFile, Object.entries(settings).map(([key, value]) => `JIAWORK_NLQ_SQLSERVER_${key.toUpperCase()}=${value}`).join('\n') + '\n');
}

async function main() {
  const data = Object.fromEntries(files.map(([table, name, pattern, left, right]) => [table, readRows(table, name, pattern, left, right)]));
  for (const [table, rows] of Object.entries(data)) console.log(`[CAC] ${table}: ${rows.length} records checked`);
  if (checkOnly) return;
  ensureContainer();
  const password = adminPassword();
  const config = { server: '127.0.0.1', port: 14333, user: 'sa', password,
    options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 120000, connectionTimeout: 30000 };
  let master;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try { master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect(); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 2000)); }
  }
  if (!master) throw new Error('SQL Server did not become ready');
  try {
    await master.request().query(`IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}]`);
  } finally { await master.close(); }
  const pool = await new sql.ConnectionPool({ ...config, database }).connect();
  try {
    await createSchema(pool);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const [table, rows] of Object.entries(data)) {
        await transaction.request().query(`TRUNCATE TABLE dbo.[${table}]`);
        const fields = columns[table];
        for (let offset = 0; offset < rows.length; offset += 1000) {
          const bulk = new sql.Table(`dbo.${table}`);
          bulk.create = false;
          for (const [name, type] of fields) bulk.columns.add(name, sqlType(type), { nullable: true });
          for (const row of rows.slice(offset, offset + 1000)) bulk.rows.add(...row);
          await transaction.request().bulk(bulk);
        }
        const result = await transaction.request().query(`SELECT COUNT_BIG(*) AS [count] FROM dbo.[${table}]`);
        if (Number(result.recordset[0].count) !== rows.length) throw new Error(`${table}: imported record count mismatch`);
        console.log(`[CAC] ${table}: imported ${rows.length} records`);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    await createViews(pool);
    const readerPasswordValue = readerPassword();
    const masterAgain = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
    try { await provisionReader(masterAgain, pool, readerPasswordValue); }
    finally { await masterAgain.close(); }
    provisionDesktop(readerPasswordValue);
    console.log('[CAC] Local shadow database and read-only desktop connection are ready');
  } finally { await pool.close(); }
}

main().catch(error => { console.error('[CAC] Import failed:', error.message); process.exitCode = 1; });
