import { createServer as createHttpServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, type ServerOptions } from './server.js';

const MCP_PATH = '/mcp';

/**
 * Streamable HTTP の /mcp を 127.0.0.1 だけで待ち受ける。
 * 認証を持たないため外部には公開せず、同じマシン上のクライアント
 * （OpenAI の tunnel-client や Codex）からの接続だけを受ける。
 */
export function createHttpEndpoint(options: ServerOptions, port: number): Server {
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  return createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== MCP_PATH) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Not Found' }));
      return;
    }
    // ステートレス: リクエストごとにサーバーとトランスポートを作り、応答後に閉じる。
    const server = createServer(options);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      // ブラウザ経由の DNS リバインディングで localhost の MCP を叩かれないようにする。
      enableDnsRebindingProtection: true,
      allowedHosts,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    server
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch(error => {
        console.error('meme-gtd MCP request failed:', error instanceof Error ? error.message : error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
  });
}
