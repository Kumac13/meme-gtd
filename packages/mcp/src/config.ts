import { z } from 'zod';

const ConfigSchema = z.object({
  // 既定値を持たせない。検証用（3001）と本番（3000）の取り違えを起動時に防ぐため。
  MGTD_API_URL: z.string().url(),
  MGTD_MCP_READ_ONLY: z.enum(['true', 'false']).default('false'),
  MGTD_MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MGTD_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
});

interface McpConfig {
  apiUrl: string;
  readOnly: boolean;
  transport: 'stdio' | 'http';
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv): McpConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid meme-gtd MCP configuration. ${details}`);
  }
  return {
    apiUrl: parsed.data.MGTD_API_URL,
    readOnly: parsed.data.MGTD_MCP_READ_ONLY === 'true',
    transport: parsed.data.MGTD_MCP_TRANSPORT,
    port: parsed.data.MGTD_MCP_PORT,
  };
}
