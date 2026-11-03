/**
 * Единый обработчик ошибок Express.
 *
 * Express распознаёт этот middleware по четырём аргументам (err, req, res, next).
 * Он стоит ПОСЛЕДНИМ в цепочке и перехватывает всё, что прилетело через next(err).
 *
 * Принцип: наружу не утекают внутренности.
 *  - Ожидаемые ошибки (AppError) отдаём как есть: у них уже есть код и статус.
 *  - Неожиданные (падение драйвера, опечатка в коде) — логируем целиком,
 *    а клиенту отдаём обобщённое 500. Стек и SQL-ошибки наружу не показываем.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isAppError, ValidationError } from '../lib/errors.js';
import { errorBody } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { isProduction } from '../config/env.js';

/** 404 для несуществующих маршрутов — регистрируется до обработчика ошибок. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorBody('NOT_FOUND', `Маршрут ${req.method} ${req.path} не найден`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next обязателен в сигнатуре, иначе Express не признает middleware обработчиком ошибок.
  _next: NextFunction,
): void {
  // Ошибки Zod, проскочившие мимо validate-middleware (например, из сервиса).
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '_';
      (details[path] ??= []).push(issue.message);
    }
    res.status(400).json(errorBody('VALIDATION_ERROR', 'Ошибка валидации', details));
    return;
  }

  if (isAppError(err)) {
    // Ожидаемая ошибка: клиент получает понятный код и сообщение.
    res.status(err.statusCode).json(errorBody(err.code, err.message, err.details));
    return;
  }

  // Неожиданная ошибка — логируем полностью, наружу отдаём общее сообщение.
  logger.error({ err }, 'Необработанная ошибка');
  const message = isProduction ? 'Внутренняя ошибка сервера' : String(err);
  res.status(500).json(errorBody('INTERNAL_ERROR', message));
}

// Экспорт для единообразия — некоторые модули используют ValidationError
// напрямую из lib/errors, здесь оставлено для наглядности импорта.
export { ValidationError };
