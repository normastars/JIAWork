#!/usr/bin/env node
// Set up an isolated SQL Server fixture for the natural-language query demo.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const workDir = path.join(root, '.work');
const containerEnvFile = path.join(workDir, 'nlq-demo-container.env');
const appEnvFile = path.join(workDir, 'nlq-demo-app.env');
const containerName = 'jiawork-nlq-sqlserver-demo';
const image = 'mcr.microsoft.com/mssql/server:2022-latest';
const sqlcmd = 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -b';

function command(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').trim().split('\n').map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function writeSecret(file, contents) {
  fs.writeFileSync(file, contents, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function desktopUserDataDir() {
  if (process.platform === 'darwin') return path.join(require('node:os').homedir(), 'Library', 'Application Support', 'LobsterAI');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(require('node:os').homedir(), 'AppData', 'Roaming'), 'LobsterAI');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(require('node:os').homedir(), '.config'), 'LobsterAI');
}

function provisionDesktopConnection(appEnv) {
  const userDataDir = desktopUserDataDir();
  const configFile = path.join(userDataDir, 'nlq-connection.json');
  if (fs.existsSync(configFile)) return;
  fs.mkdirSync(userDataDir, { recursive: true });
  writeSecret(configFile, JSON.stringify({
    host: appEnv.JIAWORK_NLQ_SQLSERVER_HOST,
    port: appEnv.JIAWORK_NLQ_SQLSERVER_PORT,
    database: appEnv.JIAWORK_NLQ_SQLSERVER_DATABASE,
    user: appEnv.JIAWORK_NLQ_SQLSERVER_USER,
    password: appEnv.JIAWORK_NLQ_SQLSERVER_PASSWORD,
  }));
}

function ensureSecrets() {
  fs.mkdirSync(workDir, { recursive: true });
  if (!fs.existsSync(containerEnvFile)) {
    writeSecret(containerEnvFile, `ACCEPT_EULA=Y\nMSSQL_PID=Developer\nMSSQL_SA_PASSWORD=Jw!${crypto.randomBytes(24).toString('base64url')}\n`);
  }
  if (!fs.existsSync(appEnvFile)) {
    writeSecret(appEnvFile, [
      'JIAWORK_NLQ_SQLSERVER_HOST=127.0.0.1',
      'JIAWORK_NLQ_SQLSERVER_PORT=14333',
      'JIAWORK_NLQ_SQLSERVER_DATABASE=JIAWorkNLQDemo',
      'JIAWORK_NLQ_SQLSERVER_USER=nlq_demo_reader',
      `JIAWORK_NLQ_SQLSERVER_PASSWORD=Jw!${crypto.randomBytes(24).toString('base64url')}`,
      '',
    ].join('\n'));
  }
  return readEnv(appEnvFile);
}

function exists() {
  try {
    command(['inspect', containerName]);
    return true;
  } catch {
    return false;
  }
}

function queryAsAdmin(query, input) {
  const args = ['exec', '-i', containerName, 'sh', '-lc', `${sqlcmd} -i /dev/stdin`];
  const result = spawnSync('docker', args, { input: input ?? `${query}\nGO\n`, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('sqlcmd failed; inspect the SQL Server container logs');
  return result.stdout;
}

async function main() {
  const appEnv = ensureSecrets();
  if (!exists()) {
    console.log('[NLQ] Starting isolated SQL Server Docker container…');
    command([
      'run', '--platform', 'linux/amd64', '--name', containerName,
      '--env-file', containerEnvFile, '-p', '127.0.0.1:14333:1433',
      '-v', `${containerName}:/var/opt/mssql`, '-d', image,
    ]);
  } else {
    const state = JSON.parse(command(['inspect', containerName]))[0].State;
    if (!state.Running) command(['start', containerName]);
  }
  command(['update', '--restart', 'unless-stopped', containerName]);
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      queryAsAdmin('SELECT 1');
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  if (!ready) throw new Error('SQL Server did not become ready');
  command(['cp', path.join(root, 'tests/fixtures/nlq-sqlserver-demo.sql'), `${containerName}:/tmp/nlq-sqlserver-demo.sql`]);
  command(['exec', containerName, 'sh', '-lc', `${sqlcmd} -i /tmp/nlq-sqlserver-demo.sql`]);

  const readerPassword = appEnv.JIAWORK_NLQ_SQLSERVER_PASSWORD;
  if (!/^Jw![A-Za-z0-9_-]+$/.test(readerPassword)) throw new Error('Invalid local reader password');
  queryAsAdmin('', [
    `IF SUSER_ID(N'nlq_demo_reader') IS NULL CREATE LOGIN [nlq_demo_reader] WITH PASSWORD = N'${readerPassword}', CHECK_POLICY = ON; ELSE ALTER LOGIN [nlq_demo_reader] WITH PASSWORD = N'${readerPassword}';`,
    'GO',
    'USE [JIAWorkNLQDemo];',
    'GO',
    "IF USER_ID(N'nlq_demo_reader') IS NULL CREATE USER [nlq_demo_reader] FOR LOGIN [nlq_demo_reader];",
    'GO',
    "IF IS_ROLEMEMBER(N'db_datareader', N'nlq_demo_reader') = 0 ALTER ROLE [db_datareader] ADD MEMBER [nlq_demo_reader];",
    'GO',
  ].join('\n'));
  provisionDesktopConnection(appEnv);
  console.log('[NLQ] Demo database is ready. App credentials are in .work/nlq-demo-app.env.');
  console.log('[NLQ] Docker address: 127.0.0.1:14333; database: JIAWorkNLQDemo.');
  console.log('[NLQ] JIAWork App can connect automatically on this machine.');
}

main().catch(error => {
  console.error('[NLQ] Demo setup failed:', error.message);
  process.exitCode = 1;
});
