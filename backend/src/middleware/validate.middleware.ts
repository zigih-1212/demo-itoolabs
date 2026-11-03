/**
 * Middleware валидации входных данных по Zod-схемам.
 *
 * Смысл паттерна: контроллеры НЕ занимаются проверкой данных. Валидация
 * вынесена в отдельный слой, который выполняется ДО контроллера. Если данные
 * плохие — запрос не доходит до бизнес-логики, клиент получает 400 с описанием,
 * какие поля неверны.
 *
 * validate(schema) проверяет req.body. Для query и params схемы пишутся
 * отдельно (parseQuery, parseParams): это подчёркивает, что это разные
 * источники данных с разными правилами.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

/** Форматирует ошибки Zod в простой для фронтенда вид: { поле: [сообщения] }. */
function formatIssues(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    (details[path] ??= []).push(issue.message);
  }
  return details;
}

/** Валидация тела запроса. Результат кладётся в res.locals.body. */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Ошибка валидации данных', formatIssues(result.error)));
      return;
    }
    // Заменяем тело на провалидированное: гарантированно корректные типы,
    // обрезанные пробелы, значения по умолчанию и т.п.
    res.locals.body = result.data;
    next();
  };
}

/** Валидация строки запроса (фильтры, пагинация). Результат → res.locals.query. */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Некорректные параметры запроса', formatIssues(result.error)));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}

/** Валидация параметров маршрута (id и т.п.). Результат → res.locals.params. */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError('Некорректные параметры маршрута', formatIssues(result.error)));
      return;
    }
    res.locals.params = result.data;
    next();
  };
}

/** Достаёт провалидированное тело с явной типизацией. */
export function getBody<T>(res: Response): T {
  return res.locals.body as T;
}

/** Достаёт провалидированную строку запроса с явной типизацией. */
export function getQuery<T>(res: Response): T {
  return res.locals.query as T;
}

/** Достаёт провалидированные параметры маршрута с явной типизацией. */
export function getParams<T>(res: Response): T {
  return res.locals.params as T;
}
