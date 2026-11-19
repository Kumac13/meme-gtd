export interface ApiOptions {
  baseUrl: string;
  allowWrites?: boolean;
  timeoutMs?: number;
}

// 接続先はプロセス起動時だけ指定し、モデルには任意URLを渡させない。
export function createApi(options: ApiOptions) {
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash) {
    throw new Error('MGTD_API_URL must be an HTTP(S) origin without credentials, path, query or fragment.');
  }
  return async (path: string, method = 'GET', body?: unknown, signal?: AbortSignal) => {
    if (method !== 'GET' && !options.allowWrites) throw new Error('Writes are disabled.');
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 10_000);
    const response = await fetch(new URL(path, base), {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      redirect: 'error',
    });
    // 作成の自動再試行は二重登録を招くため行わない。上流の本文やstackをエラーへ流さない。
    if (!response.ok) throw new Error(`meme-gtd API returned HTTP ${response.status}. Check the task ID and arguments before retrying.`);
    return response.json() as Promise<unknown>;
  };
}
