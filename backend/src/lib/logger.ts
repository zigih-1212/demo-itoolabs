import pino from 'pino';
import { env, isProduction, isTest } from '../config/env.js';

/**
 * Логгер приложения.
 *
 * Почему не `console.log`: в продакшене нужны структурированные логи (JSON),
 * уровни важности, идентификатор запроса и возможность отправить логи в
 * внешнюю систему (ELK, Loki, Datadog). `console.log` этого не даёт.
 *
 * В разработке включаем «красивый» вывод (pino-pretty), в тестах —
 * полностью молчим, чтобы не засорять вывод тестов.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  // В проде — «сырой» JSON (его парсят системы сбора логов).
  // В разработке — читаемый цветной вывод.
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  // Базовые поля, которые добавляются к каждой записи лога.
  base: isProduction ? { service: 'voxdesk-api' } : undefined,
});

/** Дочерний логгер с привязкой к конкретному модулю. */
export function createLogger(module: string) {
  return logger.child({ module });
}
