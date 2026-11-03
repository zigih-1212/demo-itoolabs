/**
 * Ограничение частоты запросов (rate limiting).
 *
 * Зачем: защита от перебора паролей (brute-force) и от простого DoS.
 * Без лимита злоумышленник может отправить миллионы попыток входа.
 *
 * Лимит на вход (loginLimiter) строже общего: 10 попыток за 15 минут на IP.
 * Это стандартная практика: аутентификация — самая атакуемая точка.
 *
 * Внимание про продакшен: при нескольких инстансах приложения счётчики
 * нужно хранить в общем хранилище (Redis), иначе лимит будет «на инстанс».
 * Для демо память процесса — нормально; для масштабирования — Redis.
 */
import rateLimit from 'express-rate-limit';
import { errorBody } from '../lib/http.js';
import { isTest } from '../config/env.js';

/**
 * В автотестах лимиты отключаем: иначе прогон многих запросов подряд
 * начнёт получать 429, и тесты станут «мигающими» (flaky). Логика самого
 * лимита при этом остаётся проверенной в dev/prod-режиме.
 */
const skipInTest = (): boolean => isTest;

/** Общий лимит на все API-запросы. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  limit: 300, // до 300 запросов с одного IP за окно
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  handler: (_req, res) => {
    res.status(429).json(errorBody('RATE_LIMITED', 'Слишком много запросов. Попробуйте позже.'));
  },
});

/** Жёсткий лимит для эндпоинтов входа/регистрации/обновления токена. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  // Успешные запросы не считаем — считаем только потенциальные атаки.
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res
      .status(429)
      .json(errorBody('RATE_LIMITED', 'Слишком много попыток входа. Повторите через 15 минут.'));
  },
});
