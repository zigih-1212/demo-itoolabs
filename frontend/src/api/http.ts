import type { ApiErrorBody, ApiSuccess } from './types';

/**
 * Единая точка работы с HTTP.
 *
 * Зачем отдельный модуль, а не fetch прямо в компонентах:
 * 1. Единая обработка ошибок — API всегда отвечает в одном формате
 *    ({ data } или { error }), и разбирать его нужно ровно в одном месте.
 * 2. Токены — access-токен подставляется автоматически, а при истечении
 *    делается попытка обновить его через refresh (см. interceptor ниже).
 * 3. Таймаут и ретраи — защита от «висящих» запросов.
 *
 * В основе — нативный fetch из браузера (без axios): меньше зависимостей,
 * полный контроль над поведением.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT ?? 15000);

/** Ошибка API: несёт HTTP-статус, машинный код и текст для показа пользователю. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Колбэки, которые устанавливает auth-store, чтобы http не зависел от него напрямую. */
interface AuthHooks {
  /** Вернуть актуальный access-токен (или null, если пользователь не вошёл). */
  getAccessToken: () => string | null;
  /** Обновить access-токен по refresh; вернуть новый — или null при неудаче. */
  refresh: () => Promise<string | null>;
  /** Сообщить приложению, что сессия окончательно потеряна. */
  onUnauthorized: () => void;
}

let authHooks: AuthHooks | null = null;

/**
 * Регистрирует хуки авторизации. Вызывается один раз при инициализации стора.
 * Это разрывает циклическую зависимость «http → store → http».
 */
export function configureHttp(hooks: AuthHooks): void {
  authHooks = hooks;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Не прикреплять токен и не пытаться обновить его (для /auth/login и т.п.). */
  skipAuth?: boolean;
  /** Не пытаться обновить токен при 401 (для самого /auth/refresh). */
  skipRefresh?: boolean;
}

/** Собирает URL с query-параметрами, отбрасывая пустые значения. */
function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path}`;

  if (!query) return url;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Низкоуровневый запрос. Возвращает уже развёрнутый ответ (данные + meta),
 * либо бросает ApiError с информативным сообщением.
 */
async function rawRequest<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<ApiSuccess<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Если вызывающий код передал свой signal — отменяем при его срабатывании.
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken && !options.skipAuth) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      // credentials: 'include' — чтобы refresh-cookie (httpOnly) уходила на бэк.
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'Сервер не ответил вовремя. Попробуйте ещё раз.');
    }

    throw new ApiError(0, 'NETWORK_ERROR', 'Нет связи с сервером. Проверьте подключение.');
  } finally {
    clearTimeout(timeout);
  }

  // 204 No Content — это валидный успех без тела.
  if (response.status === 204) {
    return { data: undefined as T };
  }

  let payload: unknown = null;

  const text = await response.text();

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Не-JSON ответ (например, HTML от прокси) — считаем ошибкой сервера.
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'Некорректный ответ сервера.');
    }
  }

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Ошибка запроса (${response.status})`,
      body?.error?.details,
    );
  }

  return payload as ApiSuccess<T>;
}

/**
 * Публичный запрос с автоматическим обновлением токена.
 *
 * Логика: делаем запрос; если получаем 401 (токен истёк) и это не повторная
 * попытка — один раз пробуем обновить токен и повторить запрос. Если и это не
 * вышло — сообщаем приложению о разлогине.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const token = options.skipAuth ? null : (authHooks?.getAccessToken() ?? null);

  try {
    return await rawRequest<T>(path, options, token);
  } catch (err) {
    const shouldTryRefresh =
      err instanceof ApiError &&
      err.status === 401 &&
      !options.skipAuth &&
      !options.skipRefresh &&
      authHooks !== null;

    if (!shouldTryRefresh) throw err;

    const newToken = await authHooks!.refresh();

    if (!newToken) {
      authHooks!.onUnauthorized();
      throw err;
    }

    // Одна повторная попытка с обновлённым токеном.
    return rawRequest<T>(path, options, newToken);
  }
}

/** Удобные обёртки над request — ими и пользуются модули api/*. */
export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
