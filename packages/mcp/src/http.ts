import { createServer as createHttpServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from './server.js';
import type { ApiOptions } from './api.js';

export function createHttpEndpoint(options: ApiOptions) {
  const handler = createMcpHandler(() => createServer(options));
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const http = createHttpServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (req.url !== '/mcp') { res.writeHead(404).end(); return; }
    void nodeHandler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return { http, handler };
}
