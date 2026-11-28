#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createHttpEndpoint } from './http.js';
import { createServer } from './server.js';

// stdio では標準出力が MCP 専用になるため、ログはすべて標準エラーへ出す。
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const options = { apiUrl: config.apiUrl, readOnly: config.readOnly };

  if (config.transport === 'stdio') {
    await createServer(options).connect(new StdioServerTransport());
    return;
  }

  const http = createHttpEndpoint(options, config.port);
  http.listen(config.port, '127.0.0.1', () => {
    console.error(`meme-gtd MCP listening on http://127.0.0.1:${config.port}/mcp (API: ${config.apiUrl}, read-only: ${config.readOnly})`);
  });
  const shutdown = () => {
    http.close();
    http.closeAllConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
