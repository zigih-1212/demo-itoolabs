/**
 * Сборка Express-приложения.
 *
 * ВАЖНО: этот файл только СОБИРАЕТ приложение из частей и не запускает сервер.
 * Это осознанное разделение:
 *  - app.ts можно импортировать в тестах (supertest) без реального порта;
 *  - index.ts отвечает за запуск, сигналы и корректное завершение.
 *
 * Порядок middleware принципиален:
 *  1. Безопасность (helmet) — задаёт защитные заголовки.
 *  2. CORS — до маршрутов, чтобы preflight-запросы обрабатывались.
 *  3. Парсеры тела и cookie.
 *  4. Логирование HTTP.
 *  5. Rate limit.
 *  6. Маршруты API.
 *  7. 404 и глобальный обработчик ошибок — строго последними.
 */
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { queuesRouter } from './modules/queues/queues.routes.js';
import { callsRouter } from './modules/calls/calls.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { success } from './lib/http.js';

export function createApp(): Express {
  const app = express();

  /**
   * За прокси-балансировщиком (nginx, Docker, облако) Express должен
   * доверять заголовку X-Forwarded-For, иначе rate-limit и логи увидят
   * IP балансировщика, а не клиента. `1` — доверяем одному уровню прокси.
   */
  app.set('trust proxy', 1);

  // 1. Защитные HTTP-заголовки. contentSecurityPolicy отключён, потому что
  //    API отдаёт JSON и не рендерит HTML; CSP нужен на уровне фронтенда.
  app.use(helmet({ contentSecurityPolicy: false }));

  // 2. CORS. Разрешаем только наш фронтенд (CORS_ORIGIN), с cookie.
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );

  // 3. Парсеры. Лимит размера тела защищает от «тяжёлых» запросов.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Gzip-сжатие ответов — меньше трафика, быстрее фронтенд.
  app.use(compression());

  // 5. Логирование HTTP-запросов (кроме тестов — там шум не нужен).
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // 6. Общий rate-limit на API.
  app.use('/api', apiLimiter);

  // 7. Проверка «живости» сервиса — используется мониторингом и Docker healthcheck.
  app.get('/api/health', (_req, res) => {
    res.json(success({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
  });

  // 8. Маршруты модулей.
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/queues', queuesRouter);
  app.use('/api/calls', callsRouter);
  app.use('/api/analytics', analyticsRouter);

  // 9. 404 и глобальный обработчик ошибок — всегда последними.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
