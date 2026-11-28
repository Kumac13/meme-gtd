import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MgtdConfig } from 'meme-gtd-config';
import { ensureDatabase } from 'meme-gtd-db';
// 実 API を一時 DB で起動して結合テストする（本番・検証用 DB には触れない）。
import { buildApp } from '../../api/src/server.js';
import { createServer } from '../src/server.js';

export interface ToolResult {
  isError: boolean;
  text: string;
  data: any;
}

export interface TestEnv {
  apiUrl: string;
  client: Client;
  /** MCP を通さずに REST API を直接呼ぶ（MCP が公開しない操作での準備・確認用）。 */
  rest: (method: string, path: string, body?: unknown) => Promise<any>;
  call: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>;
  /** 成功を前提に呼び、structuredContent を返す。 */
  ok: (name: string, args?: Record<string, unknown>) => Promise<any>;
  close: () => Promise<void>;
}

export async function connectClient(apiUrl: string, readOnly = false): Promise<Client> {
  const server = createServer({ apiUrl, readOnly });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'meme-gtd-mcp-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

export async function createTestEnv(): Promise<TestEnv> {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'mgtd-mcp-test-')), 'test.db');
  const config: MgtdConfig = { dbPath, mode: 'local', schemaVersion: '001_init' };
  ensureDatabase(config).close();
  const app = await buildApp({ config, corsAllowedOrigins: ['*'], logger: { level: 'silent' } });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const apiUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const client = await connectClient(apiUrl);

  const rest = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path} -> HTTP ${response.status}: ${await response.text()}`);
    return response.status === 204 ? undefined : response.json();
  };

  const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    return {
      isError: result.isError === true,
      text: content.map(item => item.text ?? '').join('\n'),
      data: result.structuredContent,
    };
  };

  const ok = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await call(name, args);
    if (result.isError) throw new Error(`${name} failed: ${result.text}`);
    return result.data;
  };

  return {
    apiUrl,
    client,
    rest,
    call,
    ok,
    close: async () => {
      await client.close();
      await app.close();
    },
  };
}
