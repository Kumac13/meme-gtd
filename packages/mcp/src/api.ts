type QueryValue = string | number | boolean | undefined;

/** REST API が返したエラー。message はモデルが引数を直せるようそのまま渡す。 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Api {
  get(path: string, query?: Record<string, QueryValue>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body: unknown): Promise<unknown>;
  delete(path: string): Promise<void>;
}

interface ApiOptions {
  baseUrl: string;
  timeoutMs?: number;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      details?: Array<{ path?: unknown; message?: unknown }>;
    };
    const message = typeof body.message === 'string' ? body.message : response.statusText;
    const details = Array.isArray(body.details)
      ? body.details.map(detail => `${String(detail.path)}: ${String(detail.message)}`).join('; ')
      : '';
    return details ? `${message} (${details})` : message;
  } catch {
    return response.statusText;
  }
}

/**
 * meme-gtd REST API のクライアント。接続先は起動時の設定だけで決まり、
 * ツールの引数から URL やメソッドを指定させない。
 */
export function createApi(options: ApiOptions): Api {
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('MGTD_API_URL must be an HTTP(S) origin without path, query or fragment.');
  }
  const timeoutMs = options.timeoutMs ?? 10_000;

  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetch(new URL(path, base), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
    } catch {
      // 書き込みの自動再試行は二重登録を招くため行わない。
      throw new ApiError(0, `Could not reach the meme-gtd API at ${base.origin}. A write may or may not have been applied; check before retrying.`);
    }
    if (!response.ok) {
      throw new ApiError(response.status, `meme-gtd API returned HTTP ${response.status}: ${await readErrorMessage(response)}`);
    }
    if (response.status === 204) return undefined;
    return response.json();
  };

  return {
    get(path, query = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const qs = params.toString();
      return request('GET', qs ? `${path}?${qs}` : path);
    },
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    async delete(path) {
      await request('DELETE', path);
    },
  };
}
