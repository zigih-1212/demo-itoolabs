/**
 * Иерархия ошибок приложения.
 *
 * Идея: в коде мы бросаем осмысленные ошибки (`NotFoundError`,
 * `ValidationError`), а глобальный обработчик (см. `middleware/error-handler.ts`)
 * превращает их в единообразный JSON-ответ с правильным HTTP-статусом.
 *
 * Это избавляет от разбросанных по всему коду `res.status(404).json(...)`
 * и гарантирует, что формат ошибок одинаков везде.
 */

/** Базовый класс всех «ожидаемых» (операционных) ошибок приложения. */
export class AppError extends Error {
  /** HTTP-статус ответа. */
  public readonly statusCode: number;
  /** Машиночитаемый код ошибки (для фронтенда/локализации). */
  public readonly code: string;
  /** Дополнительные детали (например, список ошибок валидации). */
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Восстанавливаем прототип: в TS при наследовании от Error это нужно,
    // иначе `instanceof` может работать некорректно.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 — некорректные входные данные. */
export class ValidationError extends AppError {
  constructor(message = 'Некорректные данные', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** 401 — пользователь не аутентифицирован. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Требуется авторизация') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 — нет прав на действие. */
export class ForbiddenError extends AppError {
  constructor(message = 'Недостаточно прав') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — сущность не найдена. */
export class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 — конфликт (например, email уже занят). */
export class ConflictError extends AppError {
  constructor(message = 'Конфликт данных') {
    super(message, 409, 'CONFLICT');
  }
}

/** 429 — слишком много запросов. */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Слишком много запросов') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/** Проверка: является ли ошибка «нашей» (операционной), а не багом. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
