import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { test, type TestContext } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createHttpEndpoint } from '../src/http.js';
import { createApi } from '../src/api.js';

const task = { id: 7, title: 'Sample', bodyMd: 'Body', status: 'inbox', scheduledStart: null, scheduledEnd: null, isAllDay: false };

async function fixture(t: TestContext, allowWrites = true) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const api = createHttpServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) as Record<string, unknown> : undefined;
    requests.push({ method: req.method!, path: req.url!, body });
    if (req.url === '/api/tasks/404') { res.writeHead(404).end('PRIVATE UPSTREAM ERROR'); return; }
    res.setHeader('Content-Type', 'application/json');
    const item = req.url?.startsWith('/api/articles') ? { id: 8, title: 'Article', bodyMd: 'Text', origin: 'manual' }
      : req.url?.startsWith('/api/memos') ? { id: 9, bodyMd: 'Memo', createdAt: '2026-11-19T00:00:00Z', updatedAt: '2026-11-19T00:00:00Z' } : task;
    res.end(JSON.stringify(req.url?.includes('?')
      ? { data: [item], total: 1, limit: 20, offset: 0 }
      : { ...item, ...(body ?? {}), status: req.url?.endsWith('/close') ? 'done' : (body?.status ?? task.status) }));
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const apiAddress = api.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${apiAddress.port}`;
  const endpoint = createHttpEndpoint({ baseUrl, allowWrites });
  endpoint.http.listen(0, '127.0.0.1');
  await once(endpoint.http, 'listening');
  const address = endpoint.http.address() as { port: number };
  const url = new URL(`http://127.0.0.1:${address.port}/mcp`);
  const client = new Client({ name: 'test', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    await endpoint.handler.close();
    endpoint.http.closeAllConnections();
    api.closeAllConnections();
    await Promise.all([new Promise<void>(r => endpoint.http.close(() => r())), new Promise<void>(r => api.close(() => r()))]);
  });
  await client.connect(new StreamableHTTPClientTransport(url));
  return { client, url, requests, baseUrl };
}

test('HTTP discovery exposes bounded schemas and read/write annotations', async t => {
  const { client } = await fixture(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['complete_task', 'create_article', 'create_task', 'get_article', 'get_memo', 'get_task', 'list_articles', 'list_memos', 'list_tasks', 'update_article', 'update_task']);
  assert.equal(tools.find(t => t.name === 'list_tasks')?.annotations?.readOnlyHint, true);
  assert.equal(tools.find(t => t.name === 'update_task')?.annotations?.destructiveHint, true);
  assert.ok(tools.every(t => t.outputSchema));
});

test('maps query filters, creation, partial rescheduling and completion to REST', async t => {
  const { client, requests } = await fixture(t);
  const list = await client.callTool({ name: 'list_tasks', arguments: { search: '予定 & test', scheduledFrom: '2026-11-19' } });
  assert.equal(list.isError, undefined);
  assert.equal((list.structuredContent as { timeZone: string }).timeZone, 'Asia/Tokyo');
  const query = new URL(requests[0].path, 'http://test').searchParams;
  assert.equal(query.get('search'), '予定 & test');
  assert.equal(query.get('limit'), '20');
  const created = await client.callTool({ name: 'create_task', arguments: { title: 'New task' } });
  assert.equal(created.isError, undefined);
  assert.deepEqual(requests[1], { method: 'POST', path: '/api/tasks', body: { title: 'New task' } });
  const updated = await client.callTool({ name: 'update_task', arguments: { id: 7, changes: { scheduledStart: '2026-11-19T14:00:00', scheduledEnd: null } } });
  assert.equal(updated.isError, undefined);
  assert.deepEqual(requests[2], { method: 'PATCH', path: '/api/tasks/7', body: { scheduledStart: '2026-11-19T14:00:00', scheduledEnd: null } });
  const done = await client.callTool({ name: 'complete_task', arguments: { id: 7 } });
  assert.equal((done.structuredContent as { task: { status: string } }).task.status, 'done');
  assert.equal(requests[3].path, '/api/tasks/7/close');
});

test('rejects invalid arguments before contacting REST and masks upstream errors', async t => {
  const { client, requests } = await fixture(t);
  for (const [name, args] of [
    ['get_task', { id: -1 }], ['list_tasks', { limit: 101 }],
    ['create_task', { title: ' ' }], ['create_task', { title: 'x', scheduledStart: '2026-02-30T10:00:00' }],
    ['update_task', { id: 7, changes: {} }], ['update_task', { id: 7, changes: { scheduledStart: '2026-11-19T14:00:00Z' } }],
  ] as const) {
    assert.equal((await client.callTool({ name, arguments: args })).isError, true);
  }
  assert.equal(requests.length, 0);
  const failed = await client.callTool({ name: 'get_task', arguments: { id: 404 } });
  assert.equal(failed.isError, true);
  assert.match(JSON.stringify(failed), /HTTP 404/);
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE/);
  assert.equal(requests.length, 1);
});

test('articles support CRU, memos support reads, and neither exposes deletion', async t => {
  const { client, requests } = await fixture(t);
  for (const [name, args, method, path] of [
    ['list_articles', { origin: 'manual' }, 'GET', '/api/articles?'],
    ['get_article', { id: 8 }, 'GET', '/api/articles/8'],
    ['create_article', { title: 'New article', bodyMd: 'Markdown' }, 'POST', '/api/articles'],
    ['update_article', { id: 8, changes: { bodyMd: 'Revised' } }, 'PATCH', '/api/articles/8'],
    ['list_memos', { search: 'Memo', createdFrom: '2026-11-19' }, 'GET', '/api/memos?'],
    ['get_memo', { id: 9 }, 'GET', '/api/memos/9'],
  ] as const) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, JSON.stringify(result));
    assert.equal(requests.at(-1)?.method, method);
    assert.ok(requests.at(-1)?.path.startsWith(path));
  }
  assert.deepEqual(requests[3].body, { bodyMd: 'Revised' });
  const tools = (await client.listTools()).tools;
  assert.ok(tools.every(tool => !tool.name.startsWith('delete_')));
  assert.deepEqual(tools.filter(tool => tool.name.endsWith('_memo') || tool.name.endsWith('_memos')).map(tool => tool.name).sort(), ['get_memo', 'list_memos']);
  const count = requests.length;
  assert.equal((await client.callTool({ name: 'update_article', arguments: { id: 8, changes: {} } })).isError, true);
  assert.equal(requests.length, count);
});

test('read-only mode omits writes and protects HTTP Host/Origin and endpoint', async t => {
  const { client, url, requests } = await fixture(t, false);
  assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['get_article', 'get_memo', 'get_task', 'list_articles', 'list_memos', 'list_tasks']);
  // fetchはHostを上書きしないランタイムがあるため、生HTTPで検証する。
  const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(url, { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(hostStatus, 403);
  assert.equal((await fetch(url, { headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await fetch(new URL('/other', url))).status, 404);
  await assert.rejects(createApi({ baseUrl: url.origin })('/api/tasks', 'POST', { title: 'x' }), /disabled/);
  assert.equal(requests.length, 0);
});

test('stdio process negotiates MCP and calls the same API', async t => {
  const { baseUrl, requests } = await fixture(t, false);
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: ['--import', 'tsx', 'src/index.ts'],
    env: { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), MGTD_API_URL: baseUrl, MGTD_MCP_TRANSPORT: 'stdio', MGTD_MCP_ALLOW_WRITES: 'false' },
  }));
  const result = await client.callTool({ name: 'get_task', arguments: { id: 7 } });
  assert.equal(result.isError, undefined);
  assert.equal(requests[0].path, '/api/tasks/7');
});

test('API requests time out and reject redirects without replaying writes', async t => {
  let calls = 0;
  const api = createHttpServer((req, res) => {
    calls++;
    if (req.url === '/redirect') res.writeHead(307, { Location: '/target' }).end();
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  t.after(() => { api.closeAllConnections(); api.close(); });
  const baseUrl = `http://127.0.0.1:${(api.address() as { port: number }).port}`;
  const request = createApi({ baseUrl, allowWrites: true, timeoutMs: 100 });
  await assert.rejects(request('/hang', 'POST', {}));
  await assert.rejects(request('/redirect', 'POST', {}));
  assert.equal(calls, 2);
  for (const baseUrl of ['file:///etc/passwd', 'http://user:secret@localhost', 'http://localhost/path']) {
    assert.throws(() => createApi({ baseUrl }));
  }
});
