import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import type { ResolvedMcpServer } from '../libs/openclawConfigSync';
import { writeNlqAudit } from './audit';
import { findNlqMembers, getNlqCatalog, queryNlq } from './engine';
import { describeResult } from './resultText';

const SERVER_NAME = 'jiawork-nlq';

let server: Server | null = null;
let endpoint: ResolvedMcpServer | null = null;

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function createMcpServer(): McpServer {
  const mcp = new McpServer({ name: SERVER_NAME, version: '1.0.0' });
  mcp.registerTool('get_catalog', {
    description: '查看嘉迪业务查数可用的指标、维度和业务口径。查询前先调用。',
    inputSchema: {},
  }, async () => textResult(getNlqCatalog()));
  mcp.registerTool('find_members', {
    description: '按已发布的维度核实数据库中的真实成员名称。按名称筛选前调用。',
    inputSchema: { dimension: z.string().min(1).max(100), keyword: z.string().min(1).max(100) },
  }, async ({ dimension, keyword }) => {
    try {
      return textResult(await findNlqMembers(dimension, keyword));
    } catch (error) {
      return { content: [{ type: 'text' as const, text: error instanceof Error ? error.message : '成员查询失败' }], isError: true };
    }
  });
  mcp.registerTool('query_metric', {
    description: '按已批准的指标、月份和筛选条件查询嘉迪 SQL Server 数据。不得传入 SQL。',
    inputSchema: {
      metric: z.string().min(1).max(100),
      period: z.object({ from: z.string(), to: z.string() }),
      filters: z.record(z.string(), z.array(z.string())).optional(),
      group_by: z.array(z.string()).optional(),
      compare: z.enum(['prev_year', 'prev_period']).optional(),
      with_total: z.boolean().optional(),
      share: z.boolean().optional(),
      limit: z.number().int().optional(),
    },
  }, async (args) => {
    const started = Date.now();
    try {
      const result = await queryNlq(args);
      const answer = describeResult(result);
      await writeNlqAudit({
        type: 'mcp_query',
        spec: result.spec,
        sql: result.sql,
        rows: result.rows.length,
        durationMs: Date.now() - started,
      });
      return textResult({ answer, rows: result.rows, comparison: result.comparison, unit: result.unit,
        dataAsOf: result.dataAsOf, notes: result.notes, warnings: result.warnings });
    } catch (error) {
      const message = error instanceof Error ? error.message : '数据库查询失败';
      await writeNlqAudit({ type: 'mcp_error', message, durationMs: Date.now() - started });
      return { content: [{ type: 'text' as const, text: message }], isError: true };
    }
  });
  return mcp;
}

export function getNlqMcpServerConfig(): ResolvedMcpServer | null {
  return endpoint;
}

export async function startNlqMcpServer(): Promise<void> {
  if (server) return;
  const token = randomBytes(32).toString('hex');
  const tokenBytes = Buffer.from(token);
  const listener = createServer((request, response) => {
    const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const suppliedBytes = Buffer.from(supplied);
    if (request.url !== '/mcp' || suppliedBytes.length !== tokenBytes.length
      || !timingSafeEqual(suppliedBytes, tokenBytes)) {
      response.writeHead(404).end();
      return;
    }
    const mcp = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.once('finish', () => { void mcp.close(); });
    void mcp.connect(transport).then(() => transport.handleRequest(request, response)).catch(error => {
      console.error('[NLQ] MCP request failed:', error);
      if (!response.headersSent) response.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      listener.off('error', reject);
      resolve();
    });
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('NLQ MCP address is unavailable');
  server = listener;
  endpoint = {
    name: SERVER_NAME,
    transportType: 'http',
    url: `http://127.0.0.1:${address.port}/mcp`,
    headers: { authorization: `Bearer ${token}` },
  };
  console.log('[NLQ] MCP server started');
}

export async function stopNlqMcpServer(): Promise<void> {
  const current = server;
  server = null;
  endpoint = null;
  if (current) await new Promise<void>(resolve => current.close(() => resolve()));
}
