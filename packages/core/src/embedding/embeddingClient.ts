export interface EmbeddingClientConfig {
  baseUrl: string;
  model: string;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingClientConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen3-embedding:4b',
};

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

/**
 * Generate embedding for a single text using Ollama /api/embed
 */
export const generateEmbedding = async (
  text: string,
  config: EmbeddingClientConfig
): Promise<Float32Array> => {
  const res = await fetch(`${config.baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama embed failed: ${res.status} ${res.statusText} ${body}`);
  }
  const data = (await res.json()) as OllamaEmbedResponse;
  return new Float32Array(data.embeddings[0]);
};

/**
 * Generate embeddings for multiple texts in a single request
 */
export const generateEmbeddings = async (
  texts: string[],
  config: EmbeddingClientConfig
): Promise<Float32Array[]> => {
  const res = await fetch(`${config.baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama embed failed: ${res.status} ${res.statusText} ${body}`);
  }
  const data = (await res.json()) as OllamaEmbedResponse;
  return data.embeddings.map((e) => new Float32Array(e));
};

/**
 * Check if Ollama server is reachable
 */
export const checkOllamaHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
};
