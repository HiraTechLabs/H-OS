/** RFC 9457 problem+json body returned by the kernel's exception filter (STK-007). */
export interface ProblemDetail {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly requestId?: string;
  readonly errors?: readonly { readonly path: string; readonly message: string }[];
}

/**
 * Thrown for every non-2xx response. `code` is the stable machine value; UI copy is resolved
 * from it through i18n, never from the server's English sentence (UX-006).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problem: ProblemDetail | null,
    readonly requestId: string | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

let apiBaseUrl = '/api/v1';

/** The shell passes its configured base URL once at startup; apps never hardcode one. */
export function configureApi(options: { readonly baseUrl: string }): void {
  apiBaseUrl = options.baseUrl.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

function toProblem(body: unknown): ProblemDetail | null {
  if (typeof body !== 'object' || body === null) return null;
  const candidate = body as Partial<ProblemDetail>;
  if (typeof candidate.status !== 'number' || typeof candidate.code !== 'string') return null;
  return {
    type: typeof candidate.type === 'string' ? candidate.type : 'about:blank',
    title: typeof candidate.title === 'string' ? candidate.title : 'Request failed',
    status: candidate.status,
    code: candidate.code,
    ...(typeof candidate.detail === 'string' ? { detail: candidate.detail } : {}),
    ...(typeof candidate.instance === 'string' ? { instance: candidate.instance } : {}),
    ...(typeof candidate.requestId === 'string' ? { requestId: candidate.requestId } : {}),
  };
}

export interface ApiRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Return the raw response without parsing, used by logout (204). */
  readonly expectEmpty?: boolean;
}

/**
 * Single fetch boundary: cookies travel automatically (`credentials: 'include'`), bodies are
 * JSON, and every failure becomes an {@link ApiError}. No token is ever read from or written to
 * JavaScript (SEC-009).
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json, application/problem+json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', null, null);
  }

  const text = await response.text();
  if (response.ok) {
    if (options.expectEmpty || text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  let parsed: unknown = null;
  if (text.length > 0 && contentType.includes(PROBLEM_CONTENT_TYPE)) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  const problem = toProblem(parsed);
  throw new ApiError(
    response.status,
    problem?.code ?? codeForStatus(response.status),
    problem,
    problem?.requestId ?? response.headers.get('x-request-id'),
  );
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'validation_failed';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 412:
      return 'precondition_failed';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'internal_error' : 'request_failed';
  }
}

/** Maps an error code to the i18n key that owns its user-facing copy. */
export function errorMessageKey(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'network_error':
        return 'errors.network';
      case 'unauthenticated':
        return 'errors.unauthorized';
      case 'forbidden':
        return 'errors.forbidden';
      case 'not_found':
        return 'errors.notFound';
      case 'conflict':
        return 'errors.conflict';
      case 'validation_failed':
        return 'errors.validation';
      case 'precondition_failed':
        return 'errors.precondition';
      case 'rate_limited':
        return 'errors.rateLimited';
      default:
        return error.status >= 500 ? 'errors.server' : 'errors.generic';
    }
  }
  return 'errors.generic';
}
