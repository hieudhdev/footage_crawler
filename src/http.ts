const DEFAULT_TIMEOUT_MS = 20_000;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function redactUrl(url: string): string {
  return url
    .replace(/([?&]key=)[^&]+/gi, "$1***")
    .replace(/([?&]api_key=)[^&]+/gi, "$1***")
    .replace(/([?&]client_id=)[^&]+/gi, "$1***");
}

function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 60_000);
  }
  return Math.min(1000 * 2 ** attempt, 16_000);
}

export async function httpJson<T>(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429) {
      lastError = new HttpError("rate limited", 429, redactUrl(url));
      await new Promise((r) => setTimeout(r, retryDelayMs(res, attempt)));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new HttpError(
        `HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        redactUrl(url),
      );
    }

    return (await res.json()) as T;
  }

  throw lastError instanceof Error ? lastError : new Error("request failed");
}

export async function httpBuffer(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const res = await fetch(url, {
    headers: options.headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} ${res.statusText}`, res.status, redactUrl(url));
  }
  const ab = await res.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get("content-type"),
  };
}
