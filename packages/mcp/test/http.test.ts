import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig } from '../src/config.js';
import { createHttpEndpoint } from '../src/http.js';
import { createTestEnv, type TestEnv } from './helpers.js';

async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise(resolve => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

function rawPost(port: number, path: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { Host: host, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' } },
      res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }));
  });
}

describe('Streamable HTTP endpoint', () => {
  let env: TestEnv;
  let http: Server;
  let port: number;

  before(async () => {
    env = await createTestEnv();
    port = await freePort();
    http = createHttpEndpoint({ apiUrl: env.apiUrl }, port);
    await new Promise<void>(resolve => http.listen(port, '127.0.0.1', resolve));
  });

  after(async () => {
    http.closeAllConnections();
    await new Promise(resolve => http.close(resolve));
    await env.close();
  });

  it('serves tools at /mcp without a session', async () => {
    const client = new Client({ name: 'meme-gtd-mcp-http-test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    assert.match(client.getInstructions() ?? '', /personal GTD system/);
    assert.equal((await client.listTools()).tools.length, 47);
    const created = await client.callTool({ name: 'create_task', arguments: { title: 'Over HTTP' } });
    assert.equal((created.structuredContent as { task: { title: string } }).task.title, 'Over HTTP');
    await client.close();
  });

  it('answers 404 outside /mcp', async () => {
    assert.equal(await rawPost(port, '/other', `127.0.0.1:${port}`), 404);
  });

  it('rejects a request whose Host header is not the loopback endpoint', async () => {
    assert.equal(await rawPost(port, '/mcp', 'evil.example.com'), 403);
    assert.equal(await rawPost(port, '/mcp', `127.0.0.1:${port}`), 200);
  });
});

describe('configuration', () => {
  it('requires MGTD_API_URL', () => {
    assert.throws(() => loadConfig({}), /MGTD_API_URL/);
  });

  it('defaults to stdio with writes enabled', () => {
    assert.deepEqual(loadConfig({ MGTD_API_URL: 'http://127.0.0.1:3001' }), {
      apiUrl: 'http://127.0.0.1:3001', readOnly: false, transport: 'stdio', port: 3100,
    });
  });

  it('reads the read-only switch and HTTP settings', () => {
    assert.deepEqual(
      loadConfig({ MGTD_API_URL: 'http://127.0.0.1:3001', MGTD_MCP_READ_ONLY: 'true', MGTD_MCP_TRANSPORT: 'http', MGTD_MCP_PORT: '3200' }),
      { apiUrl: 'http://127.0.0.1:3001', readOnly: true, transport: 'http', port: 3200 }
    );
  });
});
