import type { NextFunction, Request, Response } from 'express';

/**
 * Утилиты для работы с HTTP: обёртка async-хендлеров и формат ответов.
 */

/**
 * Обёртка для асинхронных обработчиков Express.
 *
 * Проблема: Express 4 не умеет ловить ошибки из `async`-функций. Если внутри
 * хендлера бросить исключение или отклонить промис, запрос «повиснет» без
 * ответа, а ошибка потеряется.
 *
 * Решение: оборачиваем каждый async-хендлер в `asyncHandler`, который ловит
 * любую ошибку и передаёт её в `next()`, откуда её подхватит глобальный
 * обработчик ошибок.
 *
 * @example
 * router.get('/calls', asyncHandler(async (req, res) => {
 *   const calls = await callsService.list();
 *   res.json({ data: calls });
 * }));
 */
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown> | unknown,
) {
  return (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Единый формат успешного ответа.
 *
 * Все успешные ответы API имеют предсказуемую форму:
 *   { data: <полезная нагрузка>, meta?: <пагинация и пр.> }
 * Это упрощает жизнь фронтенду: он всегда знает, где искать данные.
 */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccess<T> {
  return meta ? { data, meta } : { data };
}

/** Единый формат ответа с ошибкой. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorBody(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

/** Параметры пагинации, извлечённые из query-строки. */
export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Разбирает `?page=&limit=` из запроса с разумными ограничениями.
 * Ограничение `limit` защищает от запросов вида `?limit=1000000`,
 * которые могли бы положить БД.
 */
export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

/** Метаданные пагинации для ответа. */
export function paginationMeta(total: number, pagination: Pagination) {
  return {
    total,
    page: pagination.page,
    limit: pagination.limit,
    pages: Math.ceil(total / pagination.limit) || 0,
  };
}
