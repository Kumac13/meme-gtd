import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { createServer } from './server.js';
import { createHttpEndpoint } from './http.js';

const config = z.object({
  MGTD_API_URL: z.url().default('http://127.0.0.1:3001'),
  MGTD_MCP_ALLOW_WRITES: z.enum(['true', 'false']).default('false'),
  MGTD_MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MGTD_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
}).parse(process.env);
const options = { baseUrl: config.MGTD_API_URL, allowWrites: config.MGTD_MCP_ALLOW_WRITES === 'true' };

if (config.MGTD_MCP_TRANSPORT === 'stdio') {
  await serveStdio(() => createServer(options));
} else {
  const { http, handler } = createHttpEndpoint(options);
  http.listen(config.MGTD_MCP_PORT, '127.0.0.1', () => console.error(`meme-gtd MCP listening on http://127.0.0.1:${config.MGTD_MCP_PORT}/mcp`));
  http.on('error', error => { console.error(error.message); process.exitCode = 1; });
  const shutdown = async () => {
    http.close();
    await handler.close();
    http.closeAllConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
