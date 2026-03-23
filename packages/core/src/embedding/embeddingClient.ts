export interface EmbeddingClientConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  queryPrefix?: string;
}

/**
 * Load embedding config from environment variables.
 * Throws if required variables (MGTD_EMBEDDING_URL, MGTD_EMBEDDING_MODEL) are not set.
 * These are loaded from ~/.config/mgtd/.env via process.loadEnvFile() at CLI/API startup.
 */
export const loadEmbeddingConfig = (modelOverride?: string): EmbeddingClientConfig => {
  const baseUrl = process.env.MGTD_EMBEDDING_URL;
  const model = modelOverride ?? process.env.MGTD_EMBEDDING_MODEL;
  const apiKey = process.env.MGTD_EMBEDDING_API_KEY;

  if (!baseUrl || !model) {
    const missing = [
      !baseUrl && 'MGTD_EMBEDDING_URL',
      !model && 'MGTD_EMBEDDING_MODEL',
    ].filter(Boolean).join(', ');
    throw new Error(
      `Embedding not configured: ${missing} not set.\n` +
      `Configure ~/.config/mgtd/.env or set environment variables.\n` +
      `Run "mgtd init" to generate a template .env file.`
    );
  }

  // Replace literal \n with actual newlines (process.loadEnvFile reads \n as-is)
  const rawQueryPrefix = process.env.MGTD_EMBEDDING_QUERY_PREFIX;
  const queryPrefix = rawQueryPrefix?.replaceAll('\\n', '\n');

  return { baseUrl, model, apiKey, queryPrefix };
};

interface OpenAIEmbeddingData {
  embedding: number[];
  index: number;
}

interface OpenAIEmbeddingResponse {
  data: OpenAIEmbeddingData[];
}

/**
 * Generate embedding for a single text using OpenAI-compatible /v1/embeddings
 */
export const generateEmbedding = async (
  text: string,
  config: EmbeddingClientConfig
): Promise<Float32Array> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  const res = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: config.model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embedding request failed: ${res.status} ${res.statusText} ${body}`);
  }
  const data = (await res.json()) as OpenAIEmbeddingResponse;
  return new Float32Array(data.data[0].embedding);
};

/**
 * Generate embeddings for multiple texts in a single request
 */
export const generateEmbeddings = async (
  texts: string[],
  config: EmbeddingClientConfig
): Promise<Float32Array[]> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  const res = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: config.model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embedding request failed: ${res.status} ${res.statusText} ${body}`);
  }
  const data = (await res.json()) as OpenAIEmbeddingResponse;
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => new Float32Array(d.embedding));
};

/**
 * Check if embedding server is reachable
 */
export const checkEmbeddingHealth = async (baseUrl: string, apiKey?: string): Promise<boolean> => {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch(`${baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
};
