// Typed fetch wrapper. Every call site gets back a typed result or a thrown
// ApiError — network failures (the request never reached a server) are left
// to propagate as whatever `fetch` itself throws, since they are not an HTTP
// response and have no status code to report.

/** A non-2xx HTTP response, carrying the status code and a human-readable message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Nest's error body. `message` is a string for most errors and a string[] for
 * 400s raised by the global ValidationPipe (one entry per violated constraint).
 */
interface ErrorResponseBody {
  message?: unknown;
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return typeof value === 'object' && value !== null;
}

function toMessage(message: unknown): string | null {
  if (typeof message === 'string') {
    return message.length > 0 ? message : null;
  }
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === 'string' && part.length > 0);
    return parts.length > 0 ? parts.join('; ') : null;
  }
  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = isErrorResponseBody(body) ? toMessage(body.message) : null;
    if (message !== null) {
      return message;
    }
  } catch {
    // Response body wasn't JSON (or was empty) — fall back to status text below.
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
