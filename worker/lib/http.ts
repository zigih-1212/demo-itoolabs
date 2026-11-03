/**
 * HTTP-утилиты edge-версии.
 *
 * Формат ответов намеренно совпадает с Node-бэкендом, чтобы фронтенд
 * (frontend/src/api) работал без изменений:
 *   успех:  { data, meta? }
 *   ошибка: { error: { code, message, details? } }
 */

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Класс ошибки, которую безопасно вернуть клиенту с нужным статусом. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>): HttpError =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Требуется авторизация'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Недостаточно прав'): HttpError =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Ресурс не найден'): HttpError =>
  new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string): HttpError => new HttpError(409, 'CONFLICT', message);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** Успешный JSON-ответ. */
export function json(data: unknown, meta?: ApiMeta, status = 200): Response {
  const body = meta ? { data, meta } : { data };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** Ответ без тела (например, после DELETE). */
export function noContent(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

/** Ошибка в едином формате. */
export function errorResponse(error: HttpError): Response {
  const body = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** Ответ на preflight-запрос CORS. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

/**
 * Оборачивает обработчик: ловит HttpError (отдаёт как есть) и прочие
 * исключения (прячет детали, отдаёт 500). Одна точка обработки ошибок —
 * обработчики пишутся в «счастливом пути», без try/catch в каждом.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    console.error('Unhandled error:', err);
    return errorResponse(new HttpError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера'));
  }
}

/** Пагинация из query-параметров (?page=1&limit=20). */
export function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(total: number, pg: { page: number; limit: number }): ApiMeta {
  return { total, page: pg.page, limit: pg.limit, pages: Math.max(1, Math.ceil(total / pg.limit)) };
}
